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
