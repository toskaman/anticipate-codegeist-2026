import { simulatePortfolio, portfolioReport, PortfolioError, PORTFOLIO_LIMITS, fnv1a64, stableHashFast, tarjanCycles, kahnOrder, type PortfolioChangeInput } from '../src/portfolio';
import { FIXTURE_SNAPSHOT as S, FIXTURE_POLICIES as P } from '../../contracts/src/fixtures';
import { simulate, stableHash } from '../src/index';
import { PortfolioResult, PortfolioInput, PORTFOLIO_LIMITS as CONTRACT_LIMITS } from '../../contracts/src/index';
import type { ChangeOperation, EdgeKind, EvidenceStatus, GraphSnapshot } from '../../contracts/src/index';

// ---------- helpers ----------
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
const ch = (id: string, ...operations: ChangeOperation[]): PortfolioChangeInput => ({ id, label: id, operations });
const rm = (nodeId: string): ChangeOperation => ({ op: 'REMOVE_NODE', nodeId });
const dep = (nodeId: string): ChangeOperation => ({ op: 'DEPRECATE_NODE', nodeId, retainUntil: null });
const up = (nodeId: string, breaking = true): ChangeOperation => ({ op: 'UPGRADE_NODE', nodeId, breaking });
const mig = (fromNodeId: string, toNodeId: string, edgeKinds: EdgeKind[] = ['USES', 'DEPENDS_ON']): ChangeOperation => ({ op: 'MIGRATE_DEPENDENTS', fromNodeId, toNodeId, edgeKinds });
type E = [from: string, to: string, status?: EvidenceStatus, kind?: EdgeKind];
function graph(nodes: string[], edges: E[], id = 'g'): GraphSnapshot {
  return {
    snapshotId: id, projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'DEMO_FIXTURE', truncated: false, limits: { maxDepth: 10, maxNodes: 5000 },
    nodes: nodes.map((n) => ({ id: n, kind: 'SERVICE', label: n, status: 'CONFIRMED', attributes: {}, references: [] })),
    edges: edges.map(([from, to, status = 'CONFIRMED', kind = 'USES'], i) => ({ id: `e${i}`, from, to, kind, status, references: [], accessLimited: false }))
  };
}
const ids = (xs: { nodeId: string }[]) => xs.map((x) => x.nodeId);
const parse = (r: unknown) => PortfolioResult.parse(r);

const MIGRATE = ch('M-migrate', mig('svc-auth-v1', 'svc-auth-v2', ['USES']));
const REMOVE_V1 = ch('R-remove-v1', rm('svc-auth-v1'));
const REMOVE_V2 = ch('X-remove-v2', rm('svc-auth-v2'));

describe('portfolio: contracts and limits', () => {
  it('core limits mirror the contract limits; input contract enforces bounds', () => {
    expect(PORTFOLIO_LIMITS).toEqual(CONTRACT_LIMITS);
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: [MIGRATE] }).success).toBe(true);
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: [MIGRATE, MIGRATE] }).success).toBe(false);
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: [] }).success).toBe(false);
    expect(PortfolioInput.safeParse({ snapshotId: 's', changes: Array.from({ length: 11 }, (_, i) => ch(`c${i}`, rm('x'))) }).success).toBe(false);
  });
  it('fnv1a64 matches published FNV-1a 64 test vectors', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64('foobar')).toBe('85944171f73967e8');
    expect(fnv1a64('é€😀')).toMatch(/^[0-9a-f]{16}$/);
  });
  it('stableHashFast is bit-identical to the engine stableHash; per-change results equal simulate()', () => {
    for (const v of [S, { a: 'é€😀\u0000', b: [1, null, true, { z: 2, y: 'x' }] }, '', 0]) expect(stableHashFast(v)).toBe(stableHash(v));
    const r = simulatePortfolio(S, [REMOVE_V1, MIGRATE], { rules: P });
    expect(r.individual[1]!.result).toEqual(simulate(S, { scenarioId: 'R-remove-v1', label: 'R-remove-v1', operations: REMOVE_V1.operations as ChangeOperation[] }, P));
  });
});

describe('portfolio: validation (adversarial)', () => {
  const code = (f: () => unknown) => { try { f(); } catch (e) { return e instanceof PortfolioError ? [e.code, e.message] : ['OTHER', String(e)]; } return ['NONE', '']; };
  it('rejects empty, 11 changes, duplicate ids, unknown node, self-migration, too many ops, bad proposedOrder', () => {
    expect(code(() => simulatePortfolio(S, []))[0]).toBe('VALIDATION');
    expect(code(() => simulatePortfolio(S, Array.from({ length: 11 }, (_, i) => ch(`c${i}`, rm('svc-auth-v1')))))[1]).toMatch(/11 changes/);
    expect(code(() => simulatePortfolio(S, [REMOVE_V1, { ...REMOVE_V2, id: 'R-remove-v1' }]))[1]).toMatch(/duplicate change id/);
    expect(code(() => simulatePortfolio(S, [ch('a', rm('nope'))]))[1]).toMatch(/unknown node nope/);
    expect(code(() => simulatePortfolio(S, [ch('a', mig('svc-auth-v1', 'svc-auth-v1'))]))[1]).toMatch(/self-migration/);
    expect(code(() => simulatePortfolio(S, [ch('a', ...Array.from({ length: 21 }, () => rm('svc-auth-v1')))]))[1]).toMatch(/at most 20/);
    expect(code(() => simulatePortfolio(S, [ch('a')]))[1]).toMatch(/at least one operation/);
    expect(code(() => simulatePortfolio(S, [REMOVE_V1], { proposedOrder: ['zzz'] }))[1]).toMatch(/permutation/);
    expect(code(() => simulatePortfolio(S, [REMOVE_V1], { maxDepth: 0 }))[1]).toMatch(/maxDepth/);
  });
  it('rejects graphs over the documented size limits with BUDGET_EXCEEDED', () => {
    const big = graph(Array.from({ length: 2001 }, (_, i) => `n${i}`), []);
    expect(code(() => simulatePortfolio(big, [ch('a', rm('n0'))]))[0]).toBe('BUDGET_EXCEEDED');
  });
});

describe('portfolio: features (fixture)', () => {
  it('single change equals the standalone engine', () => {
    const r = parse(simulatePortfolio(S, [REMOVE_V1], { rules: P }));
    expect(r.combined.result.impacts).toEqual(r.individual[0]!.result.impacts);
    expect(r.conflicts).toEqual([]);
    expect(r.ordering.order).toEqual(['R-remove-v1']);
    expect(r.verdictExplanations[0]!.changedByOthers).toBe(false);
  });
  it('migrate-then-remove: ordering constraint, masked impacts, UNKNOWN consumer left behind', () => {
    const r = parse(simulatePortfolio(S, [REMOVE_V1, MIGRATE], { rules: P }));
    expect(r.ordering.constraints.map((c) => [c.before, c.after, c.kind])).toEqual([['M-migrate', 'R-remove-v1', 'MIGRATE_BEFORE_RETIRE']]);
    expect(r.ordering.order).toEqual(['M-migrate', 'R-remove-v1']);
    expect(ids(r.combined.result.impacts)).toEqual(['svc-batch-export']); // compatibility never proves migration of UNKNOWN deps
    expect(ids(r.maskedImpacts)).toEqual(['svc-checkout', 'svc-mobile', 'svc-partner-webhooks', 'svc-reporting']);
    const ve = r.verdictExplanations.find((v) => v.changeId === 'R-remove-v1')!;
    expect(ve.changedByOthers).toBe(true);
    expect(ve.causes.map((c) => [c.changeId, c.maskedNodeIds.length])).toEqual([['M-migrate', 4]]);
    const gM = r.evidenceGaps.find((g) => g.changeId === 'M-migrate')!.gaps;
    expect(gM).toEqual([{ edgeId: 'e4', from: 'svc-batch-export', to: 'svc-auth-v1', kind: 'UNKNOWN_NOT_MIGRATED', nodeIds: ['svc-batch-export'] }]);
    const gR = r.evidenceGaps.find((g) => g.changeId === 'R-remove-v1')!.gaps;
    expect(gR.map((g) => [g.edgeId, g.kind])).toEqual([['e4', 'UNKNOWN_ON_IMPACT_PATH']]);
    expect(r.ordering.steps.map((s) => [s.changeId, s.impacted])).toEqual([['M-migrate', 0], ['R-remove-v1', 1]]);
  });
  it('a change removes the node another migrates onto: conflict + emergent impact attributed to both', () => {
    const r = parse(simulatePortfolio(S, [MIGRATE, REMOVE_V2], { rules: P }));
    const kinds = r.conflicts.map((c) => [c.kind, c.changeIds]);
    expect(kinds).toContainEqual(['MIGRATE_ONTO_RETIRED', ['M-migrate', 'X-remove-v2']]);
    expect(kinds).toContainEqual(['EMERGENT_IMPACT', ['M-migrate', 'X-remove-v2']]);
    expect(r.emergentImpacts.map((e) => e.nodeId)).toEqual(['svc-checkout', 'svc-mobile', 'svc-partner-webhooks', 'svc-reporting']);
    const em = r.conflicts.find((c) => c.kind === 'EMERGENT_IMPACT')!;
    expect(em.reason).toMatch(/only when the changes run together/);
    const ve = r.verdictExplanations.find((v) => v.changeId === 'X-remove-v2')!;
    expect(ve.standaloneVerdict).toBe('PASS');
    expect(ve.portfolioVerdict).toBe('BLOCKED');
    expect(ve.causes).toEqual([{ changeId: 'M-migrate', gainedNodeIds: ve.gainedNodeIds, maskedNodeIds: [], verdictEffect: true }]);
    expect(r.conflicts.find((c) => c.kind === 'MIGRATE_ONTO_RETIRED')!.evidenceGapEdgeIds).toContain('e4');
  });
  it('dependency chain: removals order consumer first; breaking upgrades order dependency first', () => {
    const r = parse(simulatePortfolio(S, [REMOVE_V1, ch('P-remove-checkout', rm('svc-checkout'))]));
    expect(r.conflicts.map((c) => [c.kind, c.changeIds, c.nodeIds])).toContainEqual(['DEPENDENCY_CHAIN', ['R-remove-v1', 'P-remove-checkout'], ['svc-auth-v1', 'svc-checkout']]);
    expect(r.ordering.constraints.map((c) => [c.before, c.after, c.kind])).toEqual([['P-remove-checkout', 'R-remove-v1', 'RETIRE_CONSUMER_FIRST']]);
    expect(r.sharedImpacts).toEqual([{ nodeId: 'svc-partner-webhooks', changeIds: ['P-remove-checkout', 'R-remove-v1'] }]);
    const u = simulatePortfolio(S, [ch('U2', up('svc-checkout')), ch('U1', up('svc-auth-v1'))]);
    expect(u.ordering.constraints.map((c) => [c.before, c.after, c.kind])).toEqual([['U1', 'U2', 'DEPENDENCY_FIRST']]);
    expect(u.ordering.order).toEqual(['U1', 'U2']);
  });
  it('same target and competing migrations are conflicts', () => {
    const r = simulatePortfolio(S, [REMOVE_V1, ch('B', dep('svc-auth-v1'), mig('svc-auth-v1', 'svc-reporting', ['USES'])), MIGRATE]);
    const k = r.conflicts.map((c) => [c.kind, c.changeIds]);
    expect(k).toContainEqual(['SAME_TARGET', ['B', 'R-remove-v1']]);
    expect(k).toContainEqual(['COMPETING_MIGRATION', ['B', 'M-migrate']]);
    expect(r.conflicts.map((c) => c.conflictId)).toEqual(r.conflicts.map((_, i) => `C${i + 1}`));
  });
  it('proposed sequence is compared against constraints', () => {
    const r = simulatePortfolio(S, [REMOVE_V1, MIGRATE], { proposedOrder: ['R-remove-v1', 'M-migrate'] });
    expect(r.ordering.proposed!.violatedConstraints.map((c) => c.kind)).toEqual(['MIGRATE_BEFORE_RETIRE']);
    expect(r.ordering.proposed!.sameAsRecommended).toBe(false);
    expect(r.ordering.proposed!.steps[0]!.impacted).toBe(5); // removing first breaks every consumer in the interim
  });
  it('UNKNOWN-only paths are impacts with evidence gaps, never dropped', () => {
    const g = graph(['a', 'b', 'c'], [['b', 'a', 'UNKNOWN'], ['c', 'b', 'CONFIRMED']]);
    const r = simulatePortfolio(g, [ch('x', rm('a')), ch('y', mig('a', 'c'))]);
    expect(r.individual[0]!.result.impacts.map((i) => [i.nodeId, i.weakestStatus])).toEqual([['b', 'UNKNOWN'], ['c', 'UNKNOWN']]);
    expect(r.evidenceGaps[0]!.gaps).toEqual([{ edgeId: 'e0', from: 'b', to: 'a', kind: 'UNKNOWN_ON_IMPACT_PATH', nodeIds: ['b', 'c'] }]);
    expect(r.evidenceGaps[1]!.gaps.map((x) => x.kind)).toEqual(['UNKNOWN_NOT_MIGRATED']);
    expect(ids(r.combined.result.impacts)).toEqual(['b', 'c']); // migration cannot move an UNKNOWN dependency
  });
  it('cyclic ordering constraints are reported as unsatisfiable groups (Tarjan) and no order is returned', () => {
    const g = graph(['x', 'y', 'p', 'q', 'u', 'v'], [['u', 'x'], ['v', 'p']]);
    const r = parse(simulatePortfolio(g, [ch('A', mig('x', 'y'), rm('p')), ch('B', mig('p', 'q'), rm('x')), ch('C', up('y'))]));
    expect(r.ordering.cycles).toEqual([['A', 'B']]);
    expect(r.ordering.order).toBeNull();
    expect(r.combined.order).toEqual(['A', 'B', 'C']);
    expect(portfolioReport(r)).toMatch(/Unsatisfiable ordering: \{A, B\}/);
  });
  it('tarjan/kahn primitives', () => {
    const adj = new Map([['a', ['b']], ['b', ['c']], ['c', ['a']], ['d', ['e']], ['e', []]]);
    expect(tarjanCycles(['e', 'd', 'c', 'b', 'a'], adj)).toEqual([['a', 'b', 'c']]);
    expect(kahnOrder(['a', 'b', 'c'], adj)).toBeNull();
    expect(kahnOrder(['z', 'd', 'e', 'b'], new Map([['z', ['b']], ['d', ['e']]]))).toEqual(['d', 'e', 'z', 'b']);
  });
  it('report is concise markdown with verdict, conflicts, order and disclaimer', () => {
    const txt = portfolioReport(simulatePortfolio(S, [REMOVE_V1, MIGRATE, REMOVE_V2], { rules: P }));
    expect(txt).toMatch(/^# Portfolio impact report \(3 changes\)/);
    expect(txt).toMatch(/Combined verdict: (BLOCKED|NEEDS_REVIEW|PASS)/);
    expect(txt).toMatch(/MIGRATE_ONTO_RETIRED/);
    expect(txt).toMatch(/no probabilities, costs or failure predictions/);
    expect(txt).not.toMatch(/probability of|% chance|likely to fail/i);
  });
});

describe('portfolio: determinism and purity', () => {
  const changes = [REMOVE_V1, MIGRATE, REMOVE_V2, ch('P', rm('svc-checkout')), ch('U', up('svc-mobile'))];
  it('same input -> same hash; permuted change order -> identical result', () => {
    const a = simulatePortfolio(S, changes, { rules: P });
    expect(simulatePortfolio(S, changes, { rules: P }).resultHash).toBe(a.resultHash);
    const perm = [changes[3]!, changes[0]!, changes[4]!, changes[2]!, changes[1]!];
    expect(simulatePortfolio(S, perm, { rules: [...P].reverse() })).toEqual(a);
    expect(simulatePortfolio(S, changes, { rules: P, maxDepth: 1 }).resultHash).not.toBe(a.resultHash);
    expect(a.resultHash).toMatch(/^[0-9a-f]{16}$/);
  });
  it('does not mutate deep-frozen inputs', () => {
    const snap = deepFreeze(structuredClone(S));
    const cs = deepFreeze(structuredClone(changes));
    const rules = deepFreeze(structuredClone(P));
    const before = JSON.stringify([snap, cs, rules]);
    expect(() => simulatePortfolio(snap, cs, { rules, proposedOrder: deepFreeze(cs.map((c) => c.id)) })).not.toThrow();
    expect(JSON.stringify([snap, cs, rules])).toBe(before);
  });
});

// ---------- independent oracle ----------
function mulberry32(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Brute force: apply migrations to a plain edge list, then multi-source BFS on reversed USES/DEPENDS_ON edges. Returns node -> depth. */
function oracle(g: GraphSnapshot, ops: readonly ChangeOperation[], maxDepth: number): Map<string, number> {
  let edges = g.edges.map((e) => [e.from, e.to, e.kind, e.status] as [string, string, string, string]);
  const roots = new Set<string>();
  for (const op of ops) {
    if (op.op === 'MIGRATE_DEPENDENTS') edges = edges.map(([f, t, k, s]) => (t === op.fromNodeId && (op.edgeKinds as string[]).includes(k) && s !== 'UNKNOWN' ? [f, op.toNodeId, k, s] : [f, t, k, s]));
    else if (op.op !== 'UPGRADE_NODE' || op.breaking) roots.add(op.nodeId);
  }
  const dist = new Map<string, number>();
  for (const r of roots) dist.set(r, 0);
  let frontier = [...roots];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const n of frontier) for (const [f, t, k] of edges) if (t === n && (k === 'USES' || k === 'DEPENDS_ON') && !dist.has(f)) { dist.set(f, d); next.push(f); }
    frontier = next;
  }
  for (const r of roots) dist.delete(r);
  return dist;
}

describe('portfolio: randomized oracle comparison (50 seeded cases)', () => {
  it('individual and combined impacted sets (and depths) match a brute-force BFS', () => {
    const rnd = mulberry32(20261103);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    for (let k = 0; k < 50; k++) {
      const n = 5 + Math.floor(rnd() * 30);
      const nodes = Array.from({ length: n }, (_, i) => `n${i}`);
      const es: E[] = Array.from({ length: Math.floor(n * (1 + rnd() * 2)) }, () => [pick(nodes), pick(nodes), pick(['CONFIRMED', 'INFERRED', 'UNKNOWN'] as const), pick(['USES', 'DEPENDS_ON', 'VERIFIED_BY'] as const)]);
      const g = graph(nodes, es, `rnd${k}`);
      const changes = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, c) => ch(`c${c}`, ...Array.from({ length: 1 + Math.floor(rnd() * 3) }, (): ChangeOperation => {
        const t = pick(['R', 'D', 'U', 'M'] as const);
        if (t === 'M') { const a = pick(nodes); let b = pick(nodes); if (b === a) b = nodes[(nodes.indexOf(a) + 1) % n]!; return mig(a, b, rnd() < 0.5 ? ['USES'] : ['USES', 'DEPENDS_ON']); }
        return t === 'R' ? rm(pick(nodes)) : t === 'D' ? dep(pick(nodes)) : up(pick(nodes), rnd() < 0.7);
      })));
      const maxDepth = 1 + Math.floor(rnd() * 6);
      const r = parse(simulatePortfolio(g, changes, { maxDepth }));
      const asMap = (imps: { nodeId: string; depth: number }[]) => new Map(imps.map((i) => [i.nodeId, i.depth]));
      for (const c of changes) expect(asMap(r.individual.find((i) => i.changeId === c.id)!.result.impacts)).toEqual(oracle(g, c.operations, maxDepth));
      const ordered = r.combined.order.flatMap((id) => changes.find((c) => c.id === id)!.operations);
      expect(asMap(r.combined.result.impacts)).toEqual(oracle(g, ordered, maxDepth));
      // emergent = combined minus union of individual (independently recomputed)
      const union = new Set(changes.flatMap((c) => [...oracle(g, c.operations, maxDepth).keys()]));
      expect(r.emergentImpacts.map((e) => e.nodeId)).toEqual([...oracle(g, ordered, maxDepth).keys()].filter((x) => !union.has(x)).sort());
    }
  });
});

// ---------- benchmark ----------
describe('portfolio: benchmark (this environment only)', () => {
  for (const N of [50, 100, 200, 1000]) {
    it(`10 changes on ${N} nodes < 500 ms`, () => {
      const nodes = Array.from({ length: N }, (_, i) => `n${i}`);
      const es: E[] = nodes.slice(1).flatMap((nd, i) => [[nd, `n${Math.floor(i / 3)}`, i % 7 ? 'CONFIRMED' : 'INFERRED', 'USES'], [nd, `n${(i * 7) % N}`, i % 11 ? 'CONFIRMED' : 'UNKNOWN', 'DEPENDS_ON'], [nd, `n${(i * 13 + 5) % N}`, 'CONFIRMED', 'DEPENDS_ON']] as E[]);
      const g = graph(nodes, es, `bench${N}`);
      const s = Math.floor(N / 10);
      const changes = Array.from({ length: 10 }, (_, c) => ch(`c${c}`, ...[
        rm(`n${c * s}`), dep(`n${c * s + 1}`), up(`n${c * s + 2}`), mig(`n${(c * s + 3) % N}`, `n${(c * s + 4) % N}`), up(`n${(c * s + 5) % N}`, false)]));
      const t0 = performance.now();
      const r = simulatePortfolio(g, changes, { maxDepth: 6 });
      const ms = performance.now() - t0;
      console.log(`portfolio bench: ${N} nodes / ${es.length} edges / 10 changes = ${ms.toFixed(1)} ms; combined impacted=${r.combined.result.summary.impacted}, conflicts=${r.conflicts.length}, constraints=${r.ordering.constraints.length}, cycles=${r.ordering.cycles.length}`);
      expect(ms).toBeLessThan(500);
    });
  }
});
