#!/usr/bin/env node
/**
 * LOCAL engine micro-benchmark (#53, local part). Measures the pure engine steps on deterministic synthetic graphs.
 * This is NOT a hosted (Forge) measurement: no Jira I/O, no network, no Forge runtime limits. Do not extrapolate.
 *
 * Usage (repo root): node scripts/bench-local.mjs [--samples 50] [--out evidence/perf]
 * Writes evidence/perf/local-engine-<YYYY-MM-DD>.json and prints a Markdown table.
 *
 * Graph generator: same seeded LCG and shape as test/benchmark.test.ts (~1.6 edges/node, mixed DEPENDS_ON / USES /
 * AFFECTS / VERIFIED_BY, ~15 % UNKNOWN and ~25 % INFERRED edges, cycles allowed).
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const SAMPLES = Number(arg('samples', '50'));
const WARMUP = 5;
const OUT_DIR = path.resolve(root, arg('out', 'evidence/perf'));
if (!Number.isInteger(SAMPLES) || SAMPLES < 30) throw new Error('--samples must be an integer >= 30');

// Bundle the pure engine (TypeScript, extensionless imports) in memory; it has no runtime dependencies.
const bundle = await build({
  stdin: {
    contents: [
      "export { simulate, compareScenarios } from './packages/simulation-core/src/index';",
      "export { simulateSlip } from './packages/simulation-core/src/slip';",
      "export { simulatePortfolio } from './packages/simulation-core/src/portfolio';",
      "export { DEFAULT_POLICIES } from './src/engine/policies';"
    ].join('\n'),
    resolveDir: root, loader: 'ts', sourcefile: 'bench-entry.ts'
  },
  bundle: true, format: 'esm', platform: 'node', write: false, external: ['zod'], logLevel: 'error'
});
const engine = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

// ---------- deterministic synthetic graphs ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function gen(seed, n) {
  const r = rng(seed);
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, kind: 'SERVICE', label: `n${i}`, status: 'CONFIRMED', attributes: { statusCategory: i % 3 ? 'done' : 'indeterminate' }, references: [] }));
  const edges = [];
  const m = Math.floor(n * 1.6);
  const kinds = ['DEPENDS_ON', 'USES', 'AFFECTS', 'VERIFIED_BY'];
  for (let i = 0; i < m; i++) {
    const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a === b) continue;
    const kind = kinds[Math.floor(r() * 4)];
    const st = r() < 0.15 ? 'UNKNOWN' : r() < 0.3 ? 'INFERRED' : 'CONFIRMED';
    edges.push({ id: `e${i}`, from: `n${a}`, to: `n${b}`, kind, status: st, references: [], accessLimited: st === 'UNKNOWN' });
  }
  return { snapshotId: `bench-${seed}-${n}`, projectId: 'p', createdAt: '2026-11-02T00:00:00.000Z', expiresAt: '2026-11-03T00:00:00.000Z', mode: 'DEMO_FIXTURE', truncated: false, limits: { maxDepth: 10, maxNodes: 5000 }, nodes, edges };
}
/** Nodes ordered by number of incoming USES/DEPENDS_ON edges (desc, then id): hubs give non-trivial impact sets. */
function hubs(g) {
  const deg = new Map(g.nodes.map((x) => [x.id, 0]));
  for (const e of g.edges) if (e.kind === 'USES' || e.kind === 'DEPENDS_ON') deg.set(e.to, deg.get(e.to) + 1);
  return [...deg].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
}
/** Slip input: due dates from the same RNG family; "blocks" from propagating edges, kept acyclic (lower index blocks higher). */
function slipInput(g, seed, root) {
  const r = rng(seed * 7 + 1);
  const base = Date.parse('2027-01-04T00:00:00Z');
  const issues = g.nodes.map((x) => ({ key: x.id, due: r() < 0.1 ? null : new Date(base + Math.floor(r() * 120) * 86400000).toISOString().slice(0, 10), versions: [{ name: `v${Math.floor(r() * 5)}`, releaseDate: '2027-03-01' }] }));
  const idx = (id) => Number(id.slice(1));
  const blocks = g.edges.filter((e) => (e.kind === 'USES' || e.kind === 'DEPENDS_ON') && idx(e.to) < idx(e.from)).map((e) => ({ from: e.to, to: e.from }));
  return { issues, blocks, issueKey: root, days: 10 };
}

// ---------- measurement ----------
function measure(fn) {
  for (let i = 0; i < WARMUP; i++) fn();
  const xs = [];
  for (let i = 0; i < SAMPLES; i++) { const t0 = performance.now(); fn(); xs.push(performance.now() - t0); }
  xs.sort((a, b) => a - b);
  const q = (p) => xs[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { samples: xs.length, p50: r3(q(0.5)), p95: r3(q(0.95)), max: r3(xs[xs.length - 1]) };
}

const rules = engine.DEFAULT_POLICIES;
const rows = [];
for (const [i, n] of [50, 100, 200, 1000].entries()) {
  const seed = 1000 + i;
  const g = gen(seed, n);
  const h = hubs(g);
  const target = h[0], replacement = h[h.length - 1];
  const remove = { scenarioId: 'A', label: 'remove', operations: [{ op: 'REMOVE_NODE', nodeId: target }] };
  const scenarios = [remove,
    { scenarioId: 'B', label: 'deprecate', operations: [{ op: 'DEPRECATE_NODE', nodeId: target, retainUntil: null }] },
    { scenarioId: 'C', label: 'migrate+remove', operations: [{ op: 'MIGRATE_DEPENDENTS', fromNodeId: target, toNodeId: replacement, edgeKinds: ['USES', 'DEPENDS_ON'] }, { op: 'REMOVE_NODE', nodeId: target }] }];
  const ops = [
    (id) => ({ op: 'REMOVE_NODE', nodeId: id }), (id) => ({ op: 'DEPRECATE_NODE', nodeId: id, retainUntil: null }),
    (id) => ({ op: 'UPGRADE_NODE', nodeId: id, breaking: true }), (id) => ({ op: 'MIGRATE_DEPENDENTS', fromNodeId: id, toNodeId: replacement, edgeKinds: ['USES'] })
  ];
  const changes = h.slice(0, 10).map((id, k) => ({ id: `c${k}`, label: `change ${k}`, operations: [ops[k % ops.length](id)] }));
  const slip = slipInput(g, seed, target);

  const sim = engine.simulate(g, remove, rules, 10);
  const port = engine.simulatePortfolio(g, changes, { maxDepth: 10, rules });
  const sl = engine.simulateSlip(slip);
  rows.push({
    nodes: g.nodes.length, edges: g.edges.length, seed, rootNodeId: target,
    workload: { impactedByRemoval: sim.summary.impacted, portfolioChanges: changes.length, portfolioConflicts: port.conflicts.length, slipBlocksEdges: slip.blocks.length, slipMoved: sl.moved.length },
    stepsMs: {
      snapshotToSimulation: measure(() => engine.simulate(g, remove, rules, 10)),
      compareScenarios3: measure(() => engine.compareScenarios(g, scenarios, rules, 10)),
      slip: measure(() => engine.simulateSlip(slip)),
      portfolio10: measure(() => engine.simulatePortfolio(g, changes, { maxDepth: 10, rules }))
    }
  });
}

let commit = 'unknown', dirty = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root }).toString().trim().length > 0;
} catch { /* not a git checkout */ }
const now = new Date();
const artifact = {
  label: 'LOCAL',
  kind: 'synthetic-engine-microbenchmark',
  notHosted: 'Measured on a developer machine in plain Node.js. No Forge runtime, no Jira API calls, no network. Not a production or hosted measurement.',
  noExtrapolation: 'Synthetic random graphs; results say nothing about real Jira sites or companies.',
  generatedAt: now.toISOString(),
  commit, workingTreeDirty: dirty,
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, cpu: os.cpus()[0]?.model ?? 'unknown', cpus: os.cpus().length },
  method: { samplesPerStep: SAMPLES, warmupPerStep: WARMUP, timer: 'performance.now()', percentiles: 'nearest-rank', maxDepth: 10, rules: 'DEFAULT_POLICIES (P1-P4)',
    generator: 'seeded LCG as in test/benchmark.test.ts: ~1.6 edges/node, 4 edge kinds, ~15% UNKNOWN / ~25% INFERRED, cycles allowed; slip "blocks" kept acyclic',
    steps: { snapshotToSimulation: 'simulate(snapshot, REMOVE hub)', compareScenarios3: 'compareScenarios with remove / deprecate / migrate+remove', slip: 'simulateSlip 10 days from the hub', portfolio10: 'simulatePortfolio with 10 single-operation changes on the 10 largest hubs' } },
  results: rows
};
mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `local-engine-${now.toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify(artifact, null, 2) + '\n');

const cell = (s) => `${s.p50} / ${s.p95} / ${s.max}`;
console.log(`LOCAL synthetic engine benchmark — Node ${process.version}, commit ${commit.slice(0, 7)}${dirty ? ' (dirty)' : ''}, ${SAMPLES} samples/step; ms p50 / p95 / max`);
console.log('| Nodes | Edges | simulate | compareScenarios (3) | slip | portfolio (10) |');
console.log('|---:|---:|---|---|---|---|');
for (const r of rows) console.log(`| ${r.nodes} | ${r.edges} | ${cell(r.stepsMs.snapshotToSimulation)} | ${cell(r.stepsMs.compareScenarios3)} | ${cell(r.stepsMs.slip)} | ${cell(r.stepsMs.portfolio10)} |`);
console.log(`wrote ${path.relative(root, file)}`);
