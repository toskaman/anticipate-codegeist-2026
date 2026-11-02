/**
 * Reproducible benchmark (synthetic, annotated). Ground truth is computed by an independent brute-force
 * reachability oracle, NOT by the engine. Baseline = what a reviewer sees from the changed issue's own
 * Jira "linked issues" panel (direct links only). Results are printed as one JSON line: BENCHMARK_RESULT.
 * Limitations: synthetic graphs; no human timing; real Jira link hygiene not modelled.
 */
import { simulate } from '../packages/simulation-core/src/index';
import type { GraphSnapshot } from '../packages/contracts/src/index';
import { FIXTURE_POLICIES } from '../packages/contracts/src/fixtures';

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
type Kind = 'DEPENDS_ON' | 'USES' | 'AFFECTS' | 'VERIFIED_BY';
function gen(seed: number, n: number): GraphSnapshot {
  const r = rng(seed);
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, kind: 'ISSUE' as const, label: `n${i}`, status: 'CONFIRMED' as const, attributes: {}, references: [] }));
  const edges = [] as GraphSnapshot['edges'];
  const m = Math.floor(n * 1.6);
  for (let i = 0; i < m; i++) {
    const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a === b) continue;
    const kinds: Kind[] = ['DEPENDS_ON', 'USES', 'AFFECTS', 'VERIFIED_BY'];
    const kind = kinds[Math.floor(r() * 4)]!;
    const st = r() < 0.15 ? 'UNKNOWN' : r() < 0.3 ? 'INFERRED' : 'CONFIRMED';
    edges.push({ id: `e${i}`, from: `n${a}`, to: `n${b}`, kind, status: st as 'CONFIRMED', references: [], accessLimited: st === 'UNKNOWN' });
  }
  return { snapshotId: `b${seed}`, projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'DEMO_FIXTURE', truncated: false, limits: { maxDepth: 10, maxNodes: 5000 }, nodes, edges };
}
function oracle(g: GraphSnapshot, root: string, maxDepth: number) {
  const seen = new Map<string, number>(); let frontier = [root];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const f of frontier) for (const e of g.edges) if ((e.kind === 'DEPENDS_ON' || e.kind === 'USES') && e.to === f && e.from !== root && !seen.has(e.from)) { seen.set(e.from, d); next.push(e.from); }
    frontier = next;
  }
  return seen;
}

it('benchmark: accuracy vs oracle, recall vs direct-links baseline, latency', () => {
  const rows: { n: number; truth: number; tp: number; fp: number; fn: number; direct: number; ms: number; unknownFlagged: number; unknownTruth: number }[] = [];
  let seed = 1;
  for (const n of [20, 50, 100, 200, 500]) for (let k = 0; k < 40; k++) {
    const g = gen(seed++, n); const root = 'n0'; const D = 10;
    const truth = oracle(g, root, D);
    const t0 = performance.now();
    const res = simulate(g, { scenarioId: 'A', label: 'A', operations: [{ op: 'REMOVE_NODE', nodeId: root }] }, FIXTURE_POLICIES, D);
    const ms = performance.now() - t0;
    const got = new Set(res.impacts.map((i) => i.nodeId));
    const tp = [...got].filter((x) => truth.has(x)).length;
    const unknownTruth = res.impacts.filter((i) => i.weakestStatus === 'UNKNOWN').length;
    rows.push({ n, truth: truth.size, tp, fp: got.size - tp, fn: truth.size - tp, direct: [...truth.values()].filter((d) => d === 1).length, ms,
      unknownFlagged: res.uncertainties.filter((u) => u.reason === 'UNKNOWN_EDGE').length, unknownTruth });
  }
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const truthTotal = sum((r) => r.truth);
  const lat = (n: number) => { const xs = rows.filter((r) => r.n === n).map((r) => r.ms).sort((a, b) => a - b); return { p50: +xs[Math.floor(xs.length / 2)]!.toFixed(2), p95: +xs[Math.floor(xs.length * 0.95)]!.toFixed(2) }; };
  const result = {
    graphs: rows.length, impactedTotal: truthTotal,
    precision: sum((r) => r.tp) / Math.max(1, sum((r) => r.tp + r.fp)), recall: sum((r) => r.tp) / Math.max(1, truthTotal),
    directLinksBaselineRecall: sum((r) => r.direct) / Math.max(1, truthTotal),
    transitiveShareMissedByDirectView: 1 - sum((r) => r.direct) / Math.max(1, truthTotal),
    latencyMs: { n20: lat(20), n50: lat(50), n100: lat(100), n200: lat(200), n500: lat(500) }
  };
  console.log('BENCHMARK_RESULT ' + JSON.stringify(result));
  expect(result.precision).toBe(1);
  expect(result.recall).toBe(1);
});
