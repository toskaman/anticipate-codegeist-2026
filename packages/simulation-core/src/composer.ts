/**
 * Safe Change Composer (pure, deterministic, bounded). Given a portfolio of planned changes, enumerate a small fixed
 * set of candidate strategies, each a well-defined transformation of the operations, and evaluate every candidate
 * with the SAME portfolio engine (simulatePortfolio). Nothing here is executed; every candidate is a proposal.
 *
 * Transformations (only ones the model can express; nothing invented):
 *  - AS_PROPOSED        the changes unchanged, applied in the engine's constraint order.
 *  - RETAIN_OLD         one REMOVE_NODE becomes DEPRECATE_NODE (old component kept, open-ended).
 *  - COMPATIBLE_UPGRADE one breaking UPGRADE_NODE becomes non-breaking (assumes a compatibility layer exists).
 *  - RETAIN_ALL_COMPAT  all removals retained and all breaking upgrades made compatible.
 *  - SPLIT_PHASES       the conflicting changes ship in separate phases. Scored on the combined end state: it resolves
 *                       nothing by itself, it only makes each phase separately reviewable.
 * Migrations are never invented: "migrate consumers first" appears only as an ordering of a migration that already exists.
 *
 * Ranking: lexicographic on derivable criteria only (verdict, confirmed blockers, unknowns, impacted nodes, number of
 * changed operations, id). No costs, probabilities or risk percentages.
 */
import type { ChangeOperation, GraphSnapshot, PolicyRule, PortfolioResult, SimulationResult } from '../../contracts/src/index';
import { simulatePortfolio, type PortfolioChangeInput } from './portfolio';

export const COMPOSER_LIMITS = { maxCandidates: 8, maxTransformsPerKind: 3 } as const;
export type CandidateKind = 'AS_PROPOSED' | 'RETAIN_OLD' | 'COMPATIBLE_UPGRADE' | 'RETAIN_ALL_COMPAT' | 'SPLIT_PHASES';

export interface Transformation { changeId: string; before: ChangeOperation; after: ChangeOperation }
export interface Candidate {
  candidateId: string; kind: CandidateKind; name: string; why: string;
  transformations: Transformation[]; assumptions: string[];
  phases: string[][]; order: string[] | null; cycles: string[][];
  verdict: SimulationResult['verdict']; blockers: number; unknowns: number; impacted: number; conflicts: number;
  conflictKinds: string[]; requiredReviews: string[]; resolvedConflicts: string[]; remainingConflicts: string[];
  rank: number; dominatedBy: string | null; resultHash: string;
}
export interface ComposerResult { snapshotId: string; baselineCandidateId: string; candidates: Candidate[]; truncated: boolean; limits: string[] }

const VERDICT_RANK = { BLOCKED: 0, NEEDS_REVIEW: 1, PASS: 2 } as const;
const opKey = (o: ChangeOperation) => JSON.stringify(o);

function evaluate(snapshot: GraphSnapshot, changes: PortfolioChangeInput[], o: { maxDepth: number; rules: readonly PolicyRule[] }): PortfolioResult {
  return simulatePortfolio(snapshot, changes, { maxDepth: o.maxDepth, rules: o.rules });
}

function reviewsFor(r: PortfolioResult): string[] {
  const out = new Set<string>();
  for (const v of r.combined.result.violations) out.add(`Policy ${v.ruleId}: ${v.explanation}`.slice(0, 200).trim());
  for (const g of r.evidenceGaps) if (g.gaps.length) out.add(`Evidence gaps for ${g.changeId}: ${g.gaps.length} unknown relation(s) to review in Jira`);
  if (r.ordering.cycles.length) out.add('Ordering is unsatisfiable: changes require each other first');
  return [...out].sort().slice(0, 10);
}

export function composeSafeChanges(snapshot: GraphSnapshot, changes: readonly PortfolioChangeInput[], opts: { maxDepth: number; rules: readonly PolicyRule[] }): ComposerResult {
  const base = changes.map((c) => ({ ...c, operations: [...c.operations] }));
  const drafts: { kind: CandidateKind; name: string; why: string; transformations: Transformation[]; assumptions: string[]; split?: boolean }[] = [];
  const baseline = evaluate(snapshot, base, opts);

  drafts.push({ kind: 'AS_PROPOSED', name: 'As proposed', why: 'The changes exactly as planned, in the order the dependency constraints require.', transformations: [], assumptions: [] });

  const removals = base.flatMap((c) => c.operations.filter((o) => o.op === 'REMOVE_NODE').map((o) => ({ changeId: c.id, op: o })));
  const breaking = base.flatMap((c) => c.operations.filter((o) => o.op === 'UPGRADE_NODE' && o.breaking).map((o) => ({ changeId: c.id, op: o })));
  for (const r of removals.slice(0, COMPOSER_LIMITS.maxTransformsPerKind)) {
    const nodeId = (r.op as { nodeId: string }).nodeId;
    drafts.push({ kind: 'RETAIN_OLD', name: `Retain ${nodeId.replace(/^issue:/, '')} temporarily`, why: `Deprecate instead of removing ${nodeId}, so its current consumers keep working.`,
      transformations: [{ changeId: r.changeId, before: r.op, after: { op: 'DEPRECATE_NODE', nodeId, retainUntil: null } }],
      assumptions: [`${nodeId} stays operational until a later, separately approved removal.`] });
  }
  for (const b of breaking.slice(0, COMPOSER_LIMITS.maxTransformsPerKind)) {
    const nodeId = (b.op as { nodeId: string }).nodeId;
    drafts.push({ kind: 'COMPATIBLE_UPGRADE', name: `Compatibility phase for ${nodeId.replace(/^issue:/, '')}`, why: `Ship the upgrade of ${nodeId} behind a compatibility layer (non-breaking) first.`,
      transformations: [{ changeId: b.changeId, before: b.op, after: { op: 'UPGRADE_NODE', nodeId, breaking: false } }],
      assumptions: [`A compatibility layer keeps the old contract of ${nodeId}. This is an assumption, not proof of compatibility.`] });
  }
  if (removals.length + breaking.length > 1) {
    drafts.push({ kind: 'RETAIN_ALL_COMPAT', name: 'Retain everything, compatible upgrades', why: 'The most conservative variant: no removal and no breaking upgrade in this release.',
      transformations: [
        ...removals.map((r) => ({ changeId: r.changeId, before: r.op, after: { op: 'DEPRECATE_NODE' as const, nodeId: (r.op as { nodeId: string }).nodeId, retainUntil: null } })),
        ...breaking.map((b) => ({ changeId: b.changeId, before: b.op, after: { op: 'UPGRADE_NODE' as const, nodeId: (b.op as { nodeId: string }).nodeId, breaking: false } }))],
      assumptions: ['Every retained component stays operational.', 'Every upgraded component keeps its old contract through a compatibility layer (assumption).'] });
  }
  if (baseline.conflicts.length && base.length > 1) {
    drafts.push({ kind: 'SPLIT_PHASES', name: 'Split into separate phases', why: 'Ship interacting changes in separate releases, each reviewed on its own evidence.', transformations: [], split: true,
      assumptions: ['The end state after all phases equals the combined result: splitting resolves no conflict by itself. It lets each phase be approved and re-checked on fresh evidence.'] });
  }

  const truncated = drafts.length > COMPOSER_LIMITS.maxCandidates;
  const candidates: Candidate[] = drafts.slice(0, COMPOSER_LIMITS.maxCandidates).map((dft, idx) => {
    const byChange = new Map<string, Transformation[]>();
    for (const t of dft.transformations) byChange.set(t.changeId, [...(byChange.get(t.changeId) ?? []), t]);
    const transformed = base.map((c) => ({ ...c, operations: c.operations.map((o) => byChange.get(c.id)?.find((t) => opKey(t.before) === opKey(o))?.after ?? o) }));
    const r = dft.transformations.length ? evaluate(snapshot, transformed, opts) : baseline;
    const order = r.ordering.order ? [...r.ordering.order] : null;
    // SPLIT: phases follow the constraint order; changes involved in a conflict go into their own phase.
    const inConflict = new Set(r.conflicts.flatMap((c) => c.changeIds));
    const phases = dft.split && order ? (() => { const ph: string[][] = []; let cur: string[] = [];
      for (const id of order) { if (inConflict.has(id)) { if (cur.length) ph.push(cur); ph.push([id]); cur = []; } else cur.push(id); }
      if (cur.length) ph.push(cur); return ph; })() : [order ?? base.map((c) => c.id)];
    // Splitting in time does not change the end state: metrics are those of the combined result.
    const res = { blockers: r.combined.result.summary.blockers, verdict: r.combined.result.verdict };
    const baseIds = new Set(baseline.conflicts.map((c) => `${c.kind}:${[...c.changeIds].sort().join('+')}`));
    const nowIds = new Set(r.conflicts.map((c) => `${c.kind}:${[...c.changeIds].sort().join('+')}`));
    return {
      candidateId: `cand-${idx}`, kind: dft.kind, name: dft.name.slice(0, 120), why: dft.why, transformations: dft.transformations, assumptions: dft.assumptions,
      phases, order, cycles: r.ordering.cycles.map((c) => [...c]),
      verdict: res.verdict, blockers: res.blockers, unknowns: r.combined.result.summary.unknowns, impacted: r.combined.result.summary.impacted,
      conflicts: r.conflicts.length, conflictKinds: [...new Set(r.conflicts.map((c) => c.kind))].sort(),
      requiredReviews: reviewsFor(r),
      resolvedConflicts: [...baseIds].filter((k) => !nowIds.has(k)).sort(), remainingConflicts: [...nowIds].sort(),
      rank: 0, dominatedBy: null, resultHash: r.resultHash
    };
  });

  const key = (c: Candidate) => [VERDICT_RANK[c.verdict] * -1, c.blockers, c.cycles.length, c.conflicts, c.unknowns, c.impacted, c.transformations.length];
  const cmp = (a: Candidate, b: Candidate) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!; return a.candidateId.localeCompare(b.candidateId, 'en', { numeric: true }); };
  const ranked = [...candidates].sort(cmp);
  ranked.forEach((c, i) => { c.rank = i + 1; });
  // Dominance: another candidate is at least as good on every criterion, strictly better on one, and needs no more assumptions.
  for (const c of ranked) {
    const d = ranked.find((o) => o !== c && o.kind !== 'SPLIT_PHASES' && c.kind !== 'SPLIT_PHASES' && o.assumptions.length <= c.assumptions.length
      && key(o).every((v, i) => v <= key(c)[i]!) && key(o).some((v, i) => v < key(c)[i]!));
    c.dominatedBy = d ? d.candidateId : null;
  }
  const limits = ['Candidates are proposals: nothing is executed or approved, and Jira is unchanged.',
    'A retained or compatible variant is an assumption to verify, never proof that consumers keep working.',
    'Consumer migrations are only ordered, never invented: a "migrate first" step needs a migration already in the plan.'];
  if (truncated) limits.push(`Only the first ${COMPOSER_LIMITS.maxCandidates} candidates were evaluated.`);
  return { snapshotId: snapshot.snapshotId, baselineCandidateId: 'cand-0', candidates: ranked, truncated, limits };
}
