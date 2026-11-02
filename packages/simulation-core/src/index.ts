/**
 * Deterministic counterfactual engine. Pure functions only: no I/O, no clock, no randomness, no mutation of inputs.
 * Impact semantics: an edge `from --USES|DEPENDS_ON--> to` means changing `to` can impact `from`.
 * VERIFIED_BY / DOCUMENTED_IN / AFFECTS edges are evidence, never impact propagation.
 */
import type {
  ChangeOperation, EvidenceEdge, EvidenceStatus, GraphSnapshot, ImpactRecord, PolicyRule, PolicyViolation,
  ScenarioComparison, ScenarioDefinition, SimulationResult, UncertaintyRecord
} from '../../contracts/src/index';

export const PROPAGATING_KINDS = new Set(['USES', 'DEPENDS_ON']);
const RANK: Record<EvidenceStatus, number> = { CONFIRMED: 2, INFERRED: 1, UNKNOWN: 0 };
const weakest = (a: EvidenceStatus, b: EvidenceStatus): EvidenceStatus => (RANK[a] <= RANK[b] ? a : b);
const SEV_ORDER = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

interface WorkingGraph { attrs: ReadonlyMap<string, Record<string, unknown>>; nodes: ReadonlySet<string>; edges: readonly EvidenceEdge[]; removed: Set<string>; deprecated: Set<string>; upgraded: Set<string>; declaredCompatible: Set<string>; }

/** Apply operations to an isolated functional copy of the snapshot. */
export function applyScenario(snapshot: GraphSnapshot, scenario: ScenarioDefinition): WorkingGraph {
  const nodeIds = new Set(snapshot.nodes.map((n) => n.id));
  let edges: EvidenceEdge[] = snapshot.edges.map((e) => ({ ...e }));
  const removed = new Set<string>();
  const deprecated = new Set<string>();
  const upgraded = new Set<string>();
  const declaredCompatible = new Set<string>();
  for (const op of scenario.operations) {
    assertNode(nodeIds, op);
    switch (op.op) {
      case 'REMOVE_NODE': removed.add(op.nodeId); break;
      case 'DEPRECATE_NODE': deprecated.add(op.nodeId); break;
      // Dependency upgrade: only a breaking upgrade propagates to consumers; a compatible one changes no contract.
      // A compatible upgrade is only *declared* compatible unless a confirmed test verifies the node (see uncertainties()).
      case 'UPGRADE_NODE': if (op.breaking) upgraded.add(op.nodeId); else declaredCompatible.add(op.nodeId); break;
      case 'MIGRATE_DEPENDENTS': {
        const kinds = new Set<string>(op.edgeKinds);
        // Only known (CONFIRMED/INFERRED) dependencies can be migrated; UNKNOWN ones stay attached.
        edges = edges.map((e) => e.to === op.fromNodeId && kinds.has(e.kind) && e.status !== 'UNKNOWN'
          ? { ...e, id: `${e.id}~migrated`, to: op.toNodeId } : e);
        break;
      }
    }
  }
  return { attrs: new Map(snapshot.nodes.map((n) => [n.id, { ...n.attributes, __status: n.status, __kind: n.kind }])), nodes: nodeIds, edges, removed, deprecated, upgraded, declaredCompatible };
}

function assertNode(ids: Set<string>, op: ChangeOperation) {
  const refs = op.op === 'MIGRATE_DEPENDENTS' ? [op.fromNodeId, op.toNodeId] : [op.nodeId];
  for (const r of refs) if (!ids.has(r)) throw new Error(`VALIDATION: unknown node ${r}`);
}

/** BFS over reverse propagating edges. Cycle-safe, depth-bounded, deterministic ordering. */
export function computeImpacts(g: WorkingGraph, changed: string[], maxDepth: number): { impacts: ImpactRecord[]; truncated: boolean } {
  const incoming = new Map<string, EvidenceEdge[]>();
  for (const e of g.edges) {
    if (!PROPAGATING_KINDS.has(e.kind)) continue;
    const list = incoming.get(e.to) ?? [];
    list.push(e);
    incoming.set(e.to, list);
  }
  for (const list of incoming.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Map<string, ImpactRecord>();
  const roots = new Set(changed);
  let frontier = [...changed].sort().map((id) => ({ id, path: [] as string[], status: 'CONFIRMED' as EvidenceStatus }));
  let truncated = false;
  for (let depth = 1; frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const f of frontier) {
      for (const e of incoming.get(f.id) ?? []) {
        if (roots.has(e.from) || seen.has(e.from)) continue;
        if (depth > maxDepth) { truncated = true; continue; }
        const rec: ImpactRecord = { nodeId: e.from, depth, direct: depth === 1, pathEdgeIds: [...f.path, e.id], weakestStatus: weakest(f.status, e.status) };
        seen.set(e.from, rec);
        next.push({ id: e.from, path: rec.pathEdgeIds, status: rec.weakestStatus });
      }
    }
    frontier = next;
  }
  return { impacts: [...seen.values()].sort((a, b) => a.depth - b.depth || a.nodeId.localeCompare(b.nodeId)), truncated };
}

export function evaluatePolicies(g: WorkingGraph, impacts: ImpactRecord[], rules: PolicyRule[]): PolicyViolation[] {
  const out: PolicyViolation[] = [];
  const isRemoval = g.removed.size > 0;
  const verified = new Set(g.edges.filter((e) => e.kind === 'VERIFIED_BY' && e.status === 'CONFIRMED').map((e) => e.from));
  for (const r of [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    let hit: ImpactRecord[] = [];
    if (r.type === 'NO_REMOVAL_WITH_ACTIVE_DEPENDENTS' && isRemoval) hit = impacts.filter((i) => i.direct && i.weakestStatus !== 'UNKNOWN');
    if (r.type === 'NO_UNKNOWN_IMPACTS_ON_REMOVAL' && isRemoval) hit = impacts.filter((i) => i.weakestStatus === 'UNKNOWN');
    if (r.type === 'REQUIRE_VERIFIED_TEST_FOR_IMPACTED') hit = impacts.filter((i) => !verified.has(i.nodeId));
    if (r.type === 'NO_DECOMMISSION_WITH_OPEN_WORK' && isRemoval) {
      // Service/component decommission: open work items that reference (AFFECTS) a removed component/service.
      const open = g.edges.filter((e) => e.kind === 'AFFECTS' && g.removed.has(e.to) && e.status === 'CONFIRMED')
        .filter((e) => { const a = g.attrs.get(e.from); return a && a.__status === 'CONFIRMED' && a.statusCategory !== 'done' && a.statusCategory !== undefined && a.statusCategory !== null; })
        .sort((x, y) => x.from.localeCompare(y.from));
      hit = [...new Map(open.map((e) => [e.from, { nodeId: e.from, depth: 1, direct: true, pathEdgeIds: [e.id], weakestStatus: 'CONFIRMED' as const }])).values()];
    }
    if (hit.length) out.push({
      ruleId: r.ruleId, severity: r.severity, nodeIds: hit.map((h) => h.nodeId),
      pathEdgeIds: [...new Set(hit.flatMap((h) => h.pathEdgeIds))].sort(),
      explanation: `${r.description} Affected: ${hit.map((h) => h.nodeId).join(', ')}.`
    });
  }
  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId));
}

function uncertainties(g: WorkingGraph, impacts: ImpactRecord[], truncated: boolean): UncertaintyRecord[] {
  const byId = new Map(g.edges.map((e) => [e.id, e]));
  const out: UncertaintyRecord[] = [];
  for (const i of impacts) {
    const last = byId.get(i.pathEdgeIds[i.pathEdgeIds.length - 1]!);
    if (!last) continue;
    if (last.status === 'UNKNOWN') out.push({ nodeId: i.nodeId, edgeId: last.id, reason: 'UNKNOWN_EDGE', explanation: `Dependency of ${i.nodeId} could not be verified.` });
    else if (last.status === 'INFERRED') out.push({ nodeId: i.nodeId, edgeId: last.id, reason: 'INFERRED_ONLY', explanation: `Dependency of ${i.nodeId} is inferred, not confirmed.` });
    if (last.accessLimited) out.push({ nodeId: i.nodeId, edgeId: last.id, reason: 'ACCESS_LIMITED', explanation: 'Part of the evidence was not readable with the current permissions.' });
  }
  // Compatibility evidence: "compatible" without a CONFIRMED VERIFIED_BY test on the upgraded node is a claim, not proof.
  const verifiedNodes = new Set(g.edges.filter((e) => e.kind === 'VERIFIED_BY' && e.status === 'CONFIRMED').map((e) => e.from));
  for (const id of [...g.declaredCompatible].sort()) {
    if (verifiedNodes.has(id)) continue;
    const consumers = g.edges.filter((e) => e.to === id && PROPAGATING_KINDS.has(e.kind) && e.status !== 'UNKNOWN').length;
    if (consumers) out.push({ nodeId: id, edgeId: null, reason: 'MISSING_TEST_EVIDENCE', explanation: `Compatibility of ${id} is declared but not verified by a linked test; ${consumers} consumer(s) rely on it.` });
  }
  if (truncated) out.push({ nodeId: null, edgeId: null, reason: 'TRUNCATED', explanation: 'Traversal stopped at the depth limit; further impacts may exist.' });
  return out;
}

/** Stable canonical JSON + FNV-1a 64-bit hash (pure, portable). */
export function stableHash(value: unknown): string {
  const canon = (v: unknown): string => Array.isArray(v) ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
    : JSON.stringify(v);
  let h = 0xcbf29ce484222325n;
  for (const ch of canon(value)) { h ^= BigInt(ch.codePointAt(0)!); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, '0');
}

export function simulate(snapshot: GraphSnapshot, scenario: ScenarioDefinition, rules: PolicyRule[], maxDepth = 6): SimulationResult {
  const g = applyScenario(snapshot, scenario);
  const changed = [...new Set([...g.removed, ...g.deprecated, ...g.upgraded])];
  const { impacts, truncated } = computeImpacts(g, changed, maxDepth);
  const violations = evaluatePolicies(g, impacts, rules);
  const unc = uncertainties(g, impacts, truncated);
  const blockers = violations.filter((v) => v.severity === 'BLOCKER').length;
  const body = {
    scenarioId: scenario.scenarioId, snapshotId: snapshot.snapshotId, impacts, violations, uncertainties: unc,
    summary: { impacted: impacts.length, direct: impacts.filter((i) => i.direct).length, transitive: impacts.filter((i) => !i.direct).length, blockers, unknowns: unc.filter((u) => u.reason === 'UNKNOWN_EDGE' || u.reason === 'TRUNCATED').length },
    verdict: (blockers ? 'BLOCKED' : violations.length || unc.length ? 'NEEDS_REVIEW' : 'PASS') as SimulationResult['verdict']
  };
  return { ...body, resultHash: stableHash(body) };
}

export function compareScenarios(snapshot: GraphSnapshot, scenarios: ScenarioDefinition[], rules: PolicyRule[], maxDepth = 6): ScenarioComparison {
  const results = scenarios.map((s) => simulate(snapshot, s, rules, maxDepth));
  const diff = results.map((r) => {
    const others = results.filter((o) => o !== r);
    const otherImpacted = new Set(others.flatMap((o) => o.impacts.map((i) => i.nodeId)));
    const otherRules = new Set(others.flatMap((o) => o.violations.map((v) => v.ruleId)));
    return { scenarioId: r.scenarioId, onlyImpacted: r.impacts.map((i) => i.nodeId).filter((n) => !otherImpacted.has(n)), onlyViolatedRules: r.violations.map((v) => v.ruleId).filter((x) => !otherRules.has(x)) };
  });
  // Rank only scenarios that accomplish the change (contain a removal) ahead of those that defer it? No: rank purely on risk, report reason.
  const score = (r: SimulationResult) => [r.summary.blockers, r.violations.filter((v) => v.severity === 'HIGH').length, r.summary.unknowns, r.violations.length, r.summary.impacted];
  const ranked = [...results].sort((a, b) => { const sa = score(a), sb = score(b); for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i]! - sb[i]!; return 0; });
  const best = ranked[0];
  const tie = ranked[1] && score(ranked[1]).every((v, i) => v === score(best!)[i]);
  return {
    snapshotId: snapshot.snapshotId, results, diff,
    recommendedScenarioId: best && !tie ? best.scenarioId : null,
    recommendationReason: !best ? 'No scenarios.' : tie ? 'Scenarios are tied on blockers, high-severity violations, unknowns and impact; human judgement required.'
      : `Lowest risk ordering (blockers, high violations, unknowns, total violations, impacted nodes): ${best.summary.blockers} blockers, ${best.summary.unknowns} unknowns, ${best.violations.length} violations.`
  };
}
