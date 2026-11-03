/**
 * Portfolio Impact Simulator: bounded, deterministic simulation of 1..10 proposed changes over one frozen snapshot.
 * Pure: no I/O, no clock, no randomness, no mutation of inputs. Same input (in any change order) -> same result and hash.
 * It reports structural evidence only: no probabilities, costs or failure predictions. A migration or a declared
 * compatibility is never proof that consumers were actually migrated (UNKNOWN dependencies are never migrated).
 * See docs/design-core/PORTFOLIO_SIMULATOR.md.
 */
import type {
  ChangeOperation, EvidenceEdge, GraphSnapshot, PolicyRule, PortfolioConflict, PortfolioEvidenceGap,
  PortfolioOrderingConstraint, PortfolioResult, PortfolioStep, PortfolioVerdictExplanation, SimulationResult
} from '../../contracts/src/index';
import { applyScenario, simulateUnhashed, PROPAGATING_KINDS } from './index';

/** Mirrors PORTFOLIO_LIMITS in contracts (a test asserts equality). */
export const PORTFOLIO_LIMITS = { maxChanges: 10, maxOperationsPerChange: 20, maxNodes: 2000, maxEdges: 10000, maxDepth: 10 } as const;
export const PORTFOLIO_DISCLAIMER = 'Structural evidence only: no probabilities, costs or failure predictions. Impact means "may be affected" along recorded USES/DEPENDS_ON evidence. A migration or a declared compatibility is never proof that consumers were migrated; UNKNOWN dependencies stay attached and are listed as evidence gaps.';

export interface PortfolioChangeInput { id: string; label: string; operations: readonly ChangeOperation[] }
export interface PortfolioOptions { maxDepth?: number; rules?: readonly PolicyRule[]; proposedOrder?: readonly string[] | null }

export class PortfolioError extends Error {
  constructor(readonly code: 'VALIDATION' | 'BUDGET_EXCEEDED', readonly issues: string[]) {
    super(`${code}: ${issues.join('; ')}`);
    this.name = 'PortfolioError';
  }
}

// ---------- hashing ----------
/** Canonical JSON: object keys sorted, arrays kept in order, undefined -> null. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return v === undefined ? 'null' : JSON.stringify(v);
}

/** FNV-1a 64-bit over the UTF-8 bytes of `s`, computed with two 32-bit halves (no BigInt). Reproducibility id, not cryptographic. */
export function fnv1a64(s: string): string {
  return fnvWords(new TextEncoder().encode(s), (b, i) => b[i]!, (b) => b.length, () => 1);
}

/** FNV-1a 64 core over a sequence of integers < 2^32, with two 32-bit halves (no BigInt). */
function fnvWords<T>(src: T, at: (s: T, i: number) => number, len: (s: T) => number, step: (w: number) => number): string {
  let hi = 0xcbf29ce4, lo = 0x84222325;
  for (let i = 0, n = len(src); i < n;) {
    const w = at(src, i);
    i += step(w);
    const l = (lo ^ w) >>> 0;
    // h * 0x100000001b3 = h * 0x1b3 + (h << 40)  (mod 2^64)
    const t = l * 0x1b3; // exact: < 2^41
    lo = t >>> 0;
    hi = (Math.imul(hi, 0x1b3) + (l << 8) + Math.floor(t / 4294967296)) >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

/** Bit-identical, BigInt-free replica of the engine's `stableHash` (FNV-1a 64 XORing Unicode code points of canonical JSON). */
export function stableHashFast(value: unknown): string {
  return fnvWords(canonicalJson(value), (s, i) => s.codePointAt(i)!, (s) => s.length, (cp) => (cp > 0xffff ? 2 : 1));
}

// ---------- validation ----------
const OPS = new Set(['REMOVE_NODE', 'DEPRECATE_NODE', 'UPGRADE_NODE', 'MIGRATE_DEPENDENTS']);
const opNodes = (op: ChangeOperation): string[] => op.op === 'MIGRATE_DEPENDENTS' ? [op.fromNodeId, op.toNodeId] : [op.nodeId];

function validate(snapshot: GraphSnapshot, changes: readonly PortfolioChangeInput[], opts: PortfolioOptions, maxDepth: number) {
  const L = PORTFOLIO_LIMITS;
  if (!snapshot || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) throw new PortfolioError('VALIDATION', ['snapshot must have nodes and edges arrays']);
  if (snapshot.nodes.length > L.maxNodes || snapshot.edges.length > L.maxEdges)
    throw new PortfolioError('BUDGET_EXCEEDED', [`graph has ${snapshot.nodes.length} nodes / ${snapshot.edges.length} edges; limit is ${L.maxNodes} / ${L.maxEdges}`]);
  const issues: string[] = [];
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > L.maxDepth) issues.push(`maxDepth must be an integer in 1..${L.maxDepth}`);
  if (!Array.isArray(changes) || changes.length === 0) throw new PortfolioError('VALIDATION', ['at least one change is required']);
  if (changes.length > L.maxChanges) throw new PortfolioError('VALIDATION', [`${changes.length} changes; at most ${L.maxChanges} are allowed`]);
  const nodeIds = new Set(snapshot.nodes.map((n) => n.id));
  const seen = new Set<string>();
  for (const c of changes) {
    if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 200) { issues.push('every change needs a non-empty id (<= 200 chars)'); continue; }
    if (seen.has(c.id)) issues.push(`duplicate change id ${c.id}`);
    seen.add(c.id);
    if (typeof c.label !== 'string' || c.label.length > 200) issues.push(`change ${c.id}: label must be a string <= 200 chars`);
    if (!Array.isArray(c.operations) || c.operations.length === 0) { issues.push(`change ${c.id}: at least one operation is required`); continue; }
    if (c.operations.length > L.maxOperationsPerChange) issues.push(`change ${c.id}: ${c.operations.length} operations; at most ${L.maxOperationsPerChange}`);
    (c.operations as readonly ChangeOperation[]).forEach((op, i) => {
      if (!op || !OPS.has(op.op)) { issues.push(`change ${c.id} op #${i}: unknown operation`); return; }
      for (const n of opNodes(op)) if (!nodeIds.has(n)) issues.push(`change ${c.id} op #${i}: unknown node ${String(n)}`);
      if (op.op === 'MIGRATE_DEPENDENTS') {
        if (op.fromNodeId === op.toNodeId) issues.push(`change ${c.id} op #${i}: self-migration ${op.fromNodeId} -> ${op.toNodeId}`);
        if (!Array.isArray(op.edgeKinds) || op.edgeKinds.length === 0) issues.push(`change ${c.id} op #${i}: edgeKinds must be non-empty`);
      }
    });
  }
  const po = opts.proposedOrder;
  if (po != null && (!Array.isArray(po) || po.length !== changes.length || new Set(po).size !== po.length || po.some((id) => !seen.has(id))))
    issues.push('proposedOrder must be a permutation of the change ids');
  if (issues.length) throw new PortfolioError('VALIDATION', issues);
}

// ---------- helpers ----------
type Run = { full: boolean; result: SimulationResult; impacted: Set<string>; edgeById: Map<string, EvidenceEdge> };
type TargetKind = 'REMOVE' | 'DEPRECATE' | 'UPGRADE';
const sortU = (xs: Iterable<string>) => [...new Set(xs)].sort();
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cmpArr = (a: readonly string[], b: readonly string[]) => cmp(a.join('\u0000'), b.join('\u0000'));
const list = (xs: readonly string[], max = 8) => xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} (+${xs.length - max} more)`;

/** Roots of a change: nodes whose change propagates (removed, deprecated, breaking upgrade), with the strongest op kind. */
function targetsOf(ops: readonly ChangeOperation[]): Map<string, TargetKind> {
  const rank = { REMOVE: 0, DEPRECATE: 1, UPGRADE: 2 } as const;
  const m = new Map<string, TargetKind>();
  for (const op of ops) {
    const k: TargetKind | null = op.op === 'REMOVE_NODE' ? 'REMOVE' : op.op === 'DEPRECATE_NODE' ? 'DEPRECATE' : op.op === 'UPGRADE_NODE' && op.breaking ? 'UPGRADE' : null;
    if (op.op === 'MIGRATE_DEPENDENTS' || !k) continue;
    const prev = m.get(op.nodeId);
    if (!prev || rank[k] < rank[prev]) m.set(op.nodeId, k);
  }
  return m;
}

/** Tarjan SCC over a small directed graph; deterministic (sorted vertices and adjacency). Returns SCCs of size > 1. */
export function tarjanCycles(vertices: readonly string[], adj: ReadonlyMap<string, readonly string[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>(), low = new Map<string, number>(), onStack = new Set<string>(), stack: string[] = [], out: string[][] = [];
  const strong = (v: string) => {
    idx.set(v, index); low.set(v, index); index++; stack.push(v); onStack.add(v);
    for (const w of [...(adj.get(v) ?? [])].sort(cmp)) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1) out.push(comp.sort(cmp));
    }
  };
  for (const v of [...vertices].sort(cmp)) if (!idx.has(v)) strong(v);
  return out.sort(cmpArr);
}

/** Kahn topological sort with lexicographic tie-break; null if a cycle remains. */
export function kahnOrder(vertices: readonly string[], adj: ReadonlyMap<string, readonly string[]>): string[] | null {
  const indeg = new Map(vertices.map((v) => [v, 0]));
  for (const v of vertices) for (const w of new Set(adj.get(v) ?? [])) indeg.set(w, (indeg.get(w) ?? 0) + 1);
  const ready = vertices.filter((v) => indeg.get(v) === 0).sort(cmp);
  const order: string[] = [];
  while (ready.length) {
    const v = ready.shift()!;
    order.push(v);
    for (const w of new Set(adj.get(v) ?? [])) {
      indeg.set(w, indeg.get(w)! - 1);
      if (indeg.get(w) === 0) { ready.push(w); ready.sort(cmp); }
    }
  }
  return order.length === vertices.length ? order : null;
}

// ---------- main ----------
export function simulatePortfolio(snapshot: GraphSnapshot, changes: readonly PortfolioChangeInput[], opts: PortfolioOptions = {}): PortfolioResult {
  const maxDepth = opts.maxDepth ?? 6;
  validate(snapshot, changes, opts, maxDepth);
  const rules = [...(opts.rules ?? [])].sort((a, b) => cmp(a.ruleId, b.ruleId)) as PolicyRule[];
  const byId = new Map(changes.map((c) => [c.id, c]));
  const ids = sortU(byId.keys());
  const targets = new Map(ids.map((id) => [id, targetsOf(byId.get(id)!.operations)]));

  // Memoised runs keyed by the ordered list of change ids. Intermediate runs skip the per-result hash;
  // `full` runs (reported in the output) carry the engine's resultHash and the applied edge table.
  const cache = new Map<string, Run>();
  const run = (order: readonly string[], full = false): Run => {
    const key = order.join('\u0000');
    const hit = cache.get(key);
    if (hit && (hit.full || !full)) return hit;
    const operations = order.flatMap((id) => byId.get(id)!.operations.map((o) => ({ ...o }) as ChangeOperation));
    const scenario = { scenarioId: order.length === 1 ? order[0]! : `portfolio:${order.join('+')}`, label: order.length === 1 ? byId.get(order[0]!)!.label : 'Portfolio (combined)', operations };
    const body = simulateUnhashed(snapshot, scenario, rules, maxDepth);
    const result: SimulationResult = full ? { ...body, resultHash: stableHashFast(body) } : { ...body, resultHash: '' };
    const edgeById = full ? new Map(applyScenario(snapshot, scenario).edges.map((e) => [e.id, e])) : new Map<string, EvidenceEdge>();
    const r = { full, result, impacted: new Set(result.impacts.map((i) => i.nodeId)), edgeById };
    cache.set(key, r);
    return r;
  };

  // 1. individual runs
  const indiv = new Map(ids.map((id) => [id, run([id], true)]));

  // 2. ordering constraints (structural, from operations + individual impact sets)
  const constraints: PortfolioOrderingConstraint[] = [];
  const addC = (c: PortfolioOrderingConstraint) => {
    const ex = constraints.find((x) => x.before === c.before && x.after === c.after && x.kind === c.kind);
    if (ex) { ex.nodeIds = sortU([...ex.nodeIds, ...c.nodeIds]); return; }
    constraints.push({ ...c, nodeIds: sortU(c.nodeIds) });
  };
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    for (const op of byId.get(a)!.operations) {
      if (op.op !== 'MIGRATE_DEPENDENTS') continue;
      const k = targets.get(b)!.get(op.fromNodeId);
      if (k === 'REMOVE' || k === 'DEPRECATE')
        addC({ before: a, after: b, kind: 'MIGRATE_BEFORE_RETIRE', nodeIds: [op.fromNodeId], reason: `${a} migrates dependents off ${op.fromNodeId} (to ${op.toNodeId}); ${b} ${k === 'REMOVE' ? 'removes' : 'deprecates'} ${op.fromNodeId}, so the migration must land first.` });
    }
    // b's targets that (transitively) consume a's targets
    const ra = indiv.get(a)!;
    for (const [tb, kb] of targets.get(b)!) {
      if (!ra.impacted.has(tb)) continue;
      const rec = ra.result.impacts.find((i) => i.nodeId === tb)!;
      const root = ra.edgeById.get(rec.pathEdgeIds[0]!)?.to ?? '?';
      const ka = targets.get(a)!.get(root);
      if (kb === 'REMOVE' && (ka === 'REMOVE' || ka === 'DEPRECATE'))
        addC({ before: b, after: a, kind: 'RETIRE_CONSUMER_FIRST', nodeIds: [tb, root], reason: `${tb} (removed by ${b}) depends on ${root} (${ka === 'REMOVE' ? 'removed' : 'deprecated'} by ${a}); retire the consumer before its dependency.` });
      else
        addC({ before: a, after: b, kind: 'DEPENDENCY_FIRST', nodeIds: [root, tb], reason: `${tb} (changed by ${b}) depends on ${root} (changed by ${a}); change the dependency first so ${b} is done against its new state.` });
    }
  }
  constraints.sort((x, y) => cmp(x.before, y.before) || cmp(x.after, y.after) || cmp(x.kind, y.kind));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const c of constraints) adj.get(c.before)!.push(c.after);
  const cycles = tarjanCycles(ids, adj);
  const order = cycles.length ? null : kahnOrder(ids, adj);
  const execOrder = order ?? ids; // combined application order (id order when constraints are unsatisfiable)

  // 3. combined run + migration provenance replay (same semantics as applyScenario)
  const combined = run(execOrder, true);
  const migratedBy = new Map<string, string[]>();
  {
    let es = snapshot.edges.map((e) => ({ id: e.id, to: e.to, kind: e.kind as string, status: e.status, by: [] as string[] }));
    for (const cid of execOrder) for (const op of byId.get(cid)!.operations) {
      if (op.op !== 'MIGRATE_DEPENDENTS') continue;
      const kinds = new Set<string>(op.edgeKinds);
      es = es.map((e) => e.to === op.fromNodeId && kinds.has(e.kind) && e.status !== 'UNKNOWN' ? { ...e, id: `${e.id}~migrated`, to: op.toNodeId, by: [...e.by, cid] } : e);
    }
    for (const e of es) if (e.by.length) migratedBy.set(e.id, e.by);
  }
  const ownersOf = (node: string) => ids.filter((id) => targets.get(id)!.has(node));

  // 4. shared / emergent / masked impacts
  const impactedBy = new Map<string, string[]>();
  for (const id of ids) for (const n of indiv.get(id)!.impacted) impactedBy.set(n, [...(impactedBy.get(n) ?? []), id]);
  const sharedImpacts = [...impactedBy].filter(([, cs]) => cs.length >= 2).map(([nodeId, cs]) => ({ nodeId, changeIds: sortU(cs) })).sort((a, b) => cmp(a.nodeId, b.nodeId));
  const emergentImpacts = combined.result.impacts.filter((i) => !impactedBy.has(i.nodeId)).map((i) => {
    const root = combined.edgeById.get(i.pathEdgeIds[0]!)?.to ?? '';
    return { nodeId: i.nodeId, changeIds: sortU([...ownersOf(root), ...i.pathEdgeIds.flatMap((e) => migratedBy.get(e) ?? [])]) };
  }).sort((a, b) => cmp(a.nodeId, b.nodeId));
  const maskedImpacts = [...impactedBy].filter(([n]) => !combined.impacted.has(n)).map(([nodeId, cs]) => ({ nodeId, changeIds: sortU(cs) })).sort((a, b) => cmp(a.nodeId, b.nodeId));

  // 5. evidence gaps
  const unknownOnPaths = (r: Run, nodes: Iterable<string> | null) => {
    const m = new Map<string, Set<string>>();
    const want = nodes ? new Set(nodes) : null;
    for (const i of r.result.impacts) {
      if (want && !want.has(i.nodeId)) continue;
      for (const eid of i.pathEdgeIds) if (r.edgeById.get(eid)?.status === 'UNKNOWN') m.set(eid, (m.get(eid) ?? new Set()).add(i.nodeId));
    }
    return m;
  };
  const unmigrated = (r: Run, op: Extract<ChangeOperation, { op: 'MIGRATE_DEPENDENTS' }>) =>
    [...r.edgeById.values()].filter((e) => e.to === op.fromNodeId && e.status === 'UNKNOWN' && PROPAGATING_KINDS.has(e.kind) && (op.edgeKinds as string[]).includes(e.kind));
  const evidenceGaps = ids.map((id) => {
    const r = indiv.get(id)!;
    const gaps: PortfolioEvidenceGap[] = [...unknownOnPaths(r, null)].map(([eid, ns]) => {
      const e = r.edgeById.get(eid)!;
      return { edgeId: eid, from: e.from, to: e.to, kind: 'UNKNOWN_ON_IMPACT_PATH' as const, nodeIds: sortU(ns) };
    });
    for (const op of byId.get(id)!.operations) if (op.op === 'MIGRATE_DEPENDENTS')
      for (const e of unmigrated(r, op)) if (!gaps.some((g) => g.edgeId === e.id && g.kind === 'UNKNOWN_NOT_MIGRATED'))
        gaps.push({ edgeId: e.id, from: e.from, to: e.to, kind: 'UNKNOWN_NOT_MIGRATED', nodeIds: [e.from] });
    gaps.sort((a, b) => cmp(a.kind, b.kind) || cmp(a.edgeId, b.edgeId));
    return { changeId: id, gaps };
  });
  const gapEdgesFor = (nodeIds: readonly string[], changeIds: readonly string[], extra: string[] = []) => sortU([
    ...unknownOnPaths(combined, nodeIds).keys(), ...changeIds.flatMap((c) => [...unknownOnPaths(indiv.get(c)!, nodeIds).keys()]), ...extra]);

  // 6. conflicts
  const raw: Omit<PortfolioConflict, 'conflictId'>[] = [];
  for (const a of ids) for (const op of byId.get(a)!.operations) {
    if (op.op !== 'MIGRATE_DEPENDENTS') continue;
    for (const b of ids) {
      if (b === a) continue;
      const k = targets.get(b)!.get(op.toNodeId);
      if (k) raw.push({ kind: 'MIGRATE_ONTO_RETIRED', changeIds: [a, b], nodeIds: sortU([op.fromNodeId, op.toNodeId]),
        reason: `${a} migrates dependents of ${op.fromNodeId} onto ${op.toNodeId}, but ${b} ${k === 'REMOVE' ? 'removes' : k === 'DEPRECATE' ? 'deprecates' : 'applies a breaking upgrade to'} ${op.toNodeId}; the migrated consumers would be impacted again.`,
        evidenceGapEdgeIds: gapEdgesFor([op.fromNodeId, op.toNodeId], [a, b], unmigrated(indiv.get(a)!, op).map((e) => e.id)) });
      if (b > a) for (const op2 of byId.get(b)!.operations) {
        if (op2.op !== 'MIGRATE_DEPENDENTS' || op2.fromNodeId !== op.fromNodeId || op2.toNodeId === op.toNodeId) continue;
        if (!op.edgeKinds.some((k2) => (op2.edgeKinds as string[]).includes(k2))) continue;
        raw.push({ kind: 'COMPETING_MIGRATION', changeIds: [a, b], nodeIds: sortU([op.fromNodeId, op.toNodeId, op2.toNodeId]),
          reason: `${a} migrates dependents of ${op.fromNodeId} onto ${op.toNodeId} while ${b} migrates them onto ${op2.toNodeId}; only one destination can hold (combined run applies ${execOrder.join(' -> ')}).`,
          evidenceGapEdgeIds: gapEdgesFor([op.fromNodeId], [a, b], unmigrated(indiv.get(a)!, op).map((e) => e.id)) });
      }
    }
  }
  const allTargets = sortU(ids.flatMap((id) => [...targets.get(id)!.keys()]));
  for (const t of allTargets) {
    const owners = ownersOf(t);
    if (owners.length >= 2) raw.push({ kind: 'SAME_TARGET', changeIds: owners, nodeIds: [t],
      reason: `${owners.join(', ')} all change ${t} (${owners.map((o) => `${o}: ${targets.get(o)!.get(t)}`).join(', ')}); their effects on its consumers overlap.`, evidenceGapEdgeIds: gapEdgesFor([], owners) });
  }
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const hit = [...targets.get(b)!.keys()].filter((t) => indiv.get(a)!.impacted.has(t)).sort(cmp);
    if (!hit.length) continue;
    const ra = indiv.get(a)!;
    const roots = sortU(hit.map((t) => ra.edgeById.get(ra.result.impacts.find((i) => i.nodeId === t)!.pathEdgeIds[0]!)?.to ?? ''));
    raw.push({ kind: 'DEPENDENCY_CHAIN', changeIds: [a, b], nodeIds: sortU([...roots, ...hit]),
      reason: `${b} changes ${hit.join(', ')}, which already consume${hit.length === 1 ? 's' : ''} ${roots.join(', ')} changed by ${a}; the two changes act on the same dependency chain.`,
      evidenceGapEdgeIds: gapEdgesFor(hit, [a]) });
  }
  const emergentGroups = new Map<string, string[]>();
  for (const e of emergentImpacts) { const k = e.changeIds.join('\u0000'); emergentGroups.set(k, [...(emergentGroups.get(k) ?? []), e.nodeId]); }
  for (const [k, nodes] of emergentGroups) {
    const cs = k ? k.split('\u0000') : [];
    raw.push({ kind: 'EMERGENT_IMPACT', changeIds: cs.length ? cs : ids, nodeIds: sortU(nodes),
      reason: `${list(sortU(nodes))} ${nodes.length === 1 ? 'is' : 'are'} impacted only when the changes run together (not by any change alone); witness paths combine ${cs.length ? cs.join(' + ') : 'several changes'}.`,
      evidenceGapEdgeIds: gapEdgesFor(nodes, []) });
  }
  raw.sort((x, y) => cmp(x.kind, y.kind) || cmpArr(x.changeIds, y.changeIds) || cmpArr(x.nodeIds, y.nodeIds) || cmp(x.reason, y.reason));
  const conflicts: PortfolioConflict[] = raw.map((c, i) => ({ conflictId: `C${i + 1}`, ...c }));

  // 7. sequence steps
  const stepsFor = (seq: readonly string[]): PortfolioStep[] => seq.map((cid, k) => {
    const cur = run(seq.slice(0, k + 1));
    const prev = k ? run(seq.slice(0, k)).impacted : new Set<string>();
    return { changeId: cid, verdict: cur.result.verdict, impacted: cur.impacted.size,
      newlyImpacted: sortU([...cur.impacted].filter((n) => !prev.has(n))), noLongerImpacted: sortU([...prev].filter((n) => !cur.impacted.has(n))) };
  });
  const steps = stepsFor(execOrder);
  let proposed: PortfolioResult['ordering']['proposed'] = null;
  if (opts.proposedOrder) {
    const po = [...opts.proposedOrder];
    const pos = new Map(po.map((id, i) => [id, i]));
    proposed = { order: po, violatedConstraints: constraints.filter((c) => pos.get(c.before)! > pos.get(c.after)!).map((c) => ({ ...c, nodeIds: [...c.nodeIds] })),
      sameAsRecommended: order !== null && order.join('\u0000') === po.join('\u0000'), steps: stepsFor(po) };
  }

  // 8. verdict explanations (leave-one-out over the combined set)
  const loo = new Map(ids.map((d) => [d, ids.length > 1 ? run(execOrder.filter((x) => x !== d)) : null]));
  const all = combined;
  const verdictExplanations: PortfolioVerdictExplanation[] = ids.map((c) => {
    const ic = indiv.get(c)!;
    const gained = sortU([...all.impacted].filter((n) => !ic.impacted.has(n)));
    const masked = sortU([...ic.impacted].filter((n) => !all.impacted.has(n)));
    const without = loo.get(c);
    const marginal = without ? sortU([...all.impacted].filter((n) => !without.impacted.has(n))) : sortU(all.impacted);
    const causes = ids.filter((d) => d !== c).map((d) => {
      const w = loo.get(d)!;
      return { changeId: d, gainedNodeIds: gained.filter((n) => !w.impacted.has(n)), maskedNodeIds: masked.filter((n) => w.impacted.has(n)), verdictEffect: w.result.verdict !== all.result.verdict };
    }).filter((x) => x.gainedNodeIds.length || x.maskedNodeIds.length || x.verdictEffect);
    const attributed = new Set(causes.flatMap((x) => x.gainedNodeIds));
    const joint = gained.filter((n) => !attributed.has(n));
    const sv = ic.result.verdict, pv = all.result.verdict;
    const changedByOthers = sv !== pv || gained.length > 0 || masked.length > 0;
    const parts = [`Alone: ${sv}, ${ic.impacted.size} impacted. In portfolio: ${pv}, ${all.impacted.size} impacted.`];
    if (!changedByOthers) parts.push('The other changes do not alter its verdict or impact set.');
    else {
      if (gained.length) parts.push(`Others add ${gained.length} impacted node(s): ${list(gained)}.`);
      if (masked.length) parts.push(`${masked.length} of its impacted node(s) are no longer reported as impacted together (changed directly or migrated by others): ${list(masked)}.`);
      for (const x of causes) parts.push(`${x.changeId}: ${[x.gainedNodeIds.length ? `decisive for ${x.gainedNodeIds.length} added` : '', x.maskedNodeIds.length ? `masks ${x.maskedNodeIds.length}` : '', x.verdictEffect ? 'leaving it out changes the portfolio verdict' : ''].filter(Boolean).join('; ')}.`);
      if (joint.length) parts.push(`${joint.length} added node(s) are caused jointly by several others (no single one decisive): ${list(joint)}.`);
    }
    return { changeId: c, standaloneVerdict: sv, portfolioVerdict: pv, changedByOthers, gainedNodeIds: gained, maskedNodeIds: masked,
      marginalNodeIds: marginal, causes, jointlyCausedNodeIds: joint, explanation: parts.join(' ') };
  });

  const body: Omit<PortfolioResult, 'resultHash'> = {
    snapshotId: snapshot.snapshotId, maxDepth, changeIds: ids,
    individual: ids.map((id) => ({ changeId: id, label: byId.get(id)!.label, targetNodeIds: sortU(targets.get(id)!.keys()), result: indiv.get(id)!.result })),
    combined: { order: [...execOrder], result: combined.result },
    sharedImpacts, emergentImpacts, maskedImpacts, conflicts,
    ordering: { constraints, cycles, order, steps, proposed },
    evidenceGaps, verdictExplanations, disclaimer: PORTFOLIO_DISCLAIMER
  };
  const inputs = { snapshotId: snapshot.snapshotId, maxDepth, rules, proposedOrder: opts.proposedOrder ? [...opts.proposedOrder] : null,
    changes: ids.map((id) => { const c = byId.get(id)!; return { id, label: c.label, operations: c.operations }; }) };
  // Snapshot content is identified by snapshotId (snapshots are frozen and immutable by contract).
  return { ...body, resultHash: fnv1a64(canonicalJson({ inputs, result: body })) };
}

// ---------- report ----------
export function portfolioReport(r: PortfolioResult): string {
  const L: string[] = [];
  const c = r.combined.result;
  L.push(`# Portfolio impact report (${r.changeIds.length} change${r.changeIds.length === 1 ? '' : 's'})`, '');
  L.push(`Snapshot \`${r.snapshotId}\` · max depth ${r.maxDepth} · result hash \`${r.resultHash}\``, '');
  L.push(`**Combined verdict: ${c.verdict}** — ${c.summary.impacted} impacted (${c.summary.direct} direct), ${c.summary.blockers} blocker(s), ${c.summary.unknowns} unknown(s).`, '');
  L.push('## Changes', '', '| Change | Targets | Alone | Impacted alone | Changed by others |', '|---|---|---|---|---|');
  for (const i of r.individual) {
    const v = r.verdictExplanations.find((x) => x.changeId === i.changeId)!;
    L.push(`| ${i.changeId} — ${i.label} | ${i.targetNodeIds.join(', ') || '(none)'} | ${i.result.verdict} | ${i.result.summary.impacted} | ${v.changedByOthers ? 'yes' : 'no'} |`);
  }
  L.push('', '## Conflicts', '');
  if (!r.conflicts.length) L.push('None detected.');
  for (const x of r.conflicts) L.push(`- **${x.conflictId} ${x.kind}** (${x.changeIds.join(', ')}): ${x.reason}${x.evidenceGapEdgeIds.length ? ` Unverified evidence: ${list(x.evidenceGapEdgeIds)}.` : ''}`);
  L.push('', '## Order', '');
  if (r.ordering.cycles.length) L.push(`Unsatisfiable ordering: ${r.ordering.cycles.map((g) => `{${g.join(', ')}}`).join(' ')} — these changes require each other first; split or re-scope them.`);
  else L.push(`Recommended sequence: ${r.ordering.order!.join(' → ')}`);
  for (const k of r.ordering.constraints) L.push(`- ${k.before} before ${k.after} (${k.kind}): ${k.reason}`);
  if (r.ordering.proposed) L.push('', `Proposed sequence ${r.ordering.proposed.order.join(' → ')}: ${r.ordering.proposed.violatedConstraints.length ? `violates ${r.ordering.proposed.violatedConstraints.map((k) => `${k.before}→${k.after}`).join(', ')}` : 'respects all constraints'}.`);
  L.push('', '## Interactions', '');
  if (r.sharedImpacts.length) L.push(`- Shared impacts: ${list(r.sharedImpacts.map((s) => `${s.nodeId} [${s.changeIds.join('+')}]`))}`);
  if (r.emergentImpacts.length) L.push(`- Emergent (only together): ${list(r.emergentImpacts.map((s) => s.nodeId))}`);
  if (r.maskedImpacts.length) L.push(`- Masked (impacted alone, not together): ${list(r.maskedImpacts.map((s) => s.nodeId))}`);
  for (const v of r.verdictExplanations) if (v.changedByOthers) L.push(`- ${v.changeId}: ${v.explanation}`);
  const gaps = r.evidenceGaps.filter((g) => g.gaps.length);
  L.push('', '## Evidence gaps', '');
  if (!gaps.length) L.push('No UNKNOWN edges on impact paths.');
  for (const g of gaps) L.push(`- ${g.changeId}: ${list(g.gaps.map((x) => `${x.edgeId} (${x.kind === 'UNKNOWN_NOT_MIGRATED' ? 'not migrated' : 'on path'})`))}`);
  L.push('', `_${r.disclaimer}_`);
  return L.join('\n');
}
