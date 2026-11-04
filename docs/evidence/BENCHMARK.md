# Benchmark — accuracy, coverage and latency (reproducible)

Command: `npm test` (test/benchmark.test.ts prints `BENCHMARK_RESULT`). Run 2026-11-02 on the owner's Windows PC (Node 24.22.1), backend commit on `feat/core-engine`.

**Dataset (synthetic, annotated):** 200 random dependency graphs (40 each of 20/50/100/200/500 nodes, ~1.6 edges/node, mixed DEPENDS_ON/USES/AFFECTS/VERIFIED_BY, 15 % UNKNOWN and ~25 % INFERRED edges, cycles allowed), deterministic seeds. **Ground truth** = independent brute-force reachability oracle (not the engine).

| Metric | Result |
|---|---|
| Impacted items in ground truth | 537 |
| Engine precision / recall vs oracle | **1.00 / 1.00** |
| Recall of the "direct links only" view (what a reviewer sees in the changed issue's linked-issues panel) | **0.28** |
| Share of impacted items that are transitive (missed by direct view) | **0.72** |
| Simulation latency p50 / p95 — 100 nodes | 0.15 ms / 0.86 ms |
| — 500 nodes | 0.38 ms / 0.71 ms |

**Interpretation (honest):** the engine is exact w.r.t. the evidence it is given; the benefit over manual inspection comes from transitive propagation. On these synthetic graphs ~72 % of impacted items are not visible from the changed issue's direct links — real-world ratios depend on link density and are **not** claimed here.
**Limitations:** synthetic data; no human timing study yet; Jira extraction latency (network) not included — extraction is bounded to depth ≤ 5 / 200 nodes; real P0 run on TD-1 completed snapshot+comparison in a few seconds (UI observation, not instrumented).

## Engine step latency — LOCAL synthetic (not hosted)

Command: `node scripts/bench-local.mjs` (repo root). Artifact: [`evidence/perf/local-engine-2026-11-04.json`](../../evidence/perf/local-engine-2026-11-04.json).
Run 2026-11-04 in a Linux x64 container (2 vCPU Xeon 2.10 GHz), Node v22.23.4, base commit `9ef51c4` with uncommitted changes; 50 samples per step after 5 warm-up runs, nearest-rank percentiles, `maxDepth` 10, rules P1–P4.
Graphs: one seeded random graph per size, same generator as the accuracy benchmark above. Steps: `simulate` (remove the largest hub), `compareScenarios` (remove / deprecate / migrate+remove), `simulateSlip` (10 days, acyclic blocks), `simulatePortfolio` (10 single-operation changes on the 10 largest hubs).

| Nodes | Edges | simulate p50 / p95 / max (ms) | compareScenarios ×3 | slip | portfolio ×10 |
|---:|---:|---|---|---|---|
| 50 | 78 | 0.41 / 2.90 / 3.61 | 0.69 / 1.44 / 3.72 | 0.04 / 0.08 / 0.09 | 4.08 / 8.91 / 11.42 |
| 100 | 159 | 0.18 / 0.34 / 0.69 | 0.38 / 0.66 / 1.45 | 0.05 / 0.10 / 0.14 | 5.89 / 13.12 / 21.98 |
| 200 | 318 | 0.28 / 0.49 / 1.53 | 0.70 / 1.15 / 4.26 | 0.05 / 0.11 / 0.34 | 7.36 / 11.64 / 21.81 |
| 1000 | 1599 | 0.64 / 1.09 / 6.36 | 1.82 / 2.56 / 5.10 | 0.18 / 0.24 / 0.49 | 31.41 / 54.10 / 69.43 |

**LOCAL, synthetic, pure engine only.** No Forge runtime, no Jira API calls, no network, no storage: hosted latency is dominated by Jira extraction and is not measured here. The 50-node row includes JIT warm-up noise. These numbers are not a claim about real Jira sites or companies and must not be extrapolated to them.

## Safety & reliability results (test suite)
| Property | Test | Result |
|---|---|---|
| No write without approval | service.test.ts | 0 writes before approval |
| Idempotent re-execution / lost response | service.test.ts | no duplicate issues |
| 10 parallel executions | concurrency.test.ts | exactly 1 runs |
| Expired-lease takeover race (4 contenders) | concurrency.test.ts | exactly 1 takes over |
| Cross-user plan access | concurrency.test.ts, service.test.ts | PERMISSION_DENIED, 0 writes |
| Evidence changed after approval | drift.test.ts + real Jira | EVIDENCE_CHANGED, 0 writes |
| Partial failure honesty | service.test.ts | PARTIAL, retry verifies remaining |
| External source failure never yields PASS | context.test.ts | verdict unchanged, coverage UNAVAILABLE |
