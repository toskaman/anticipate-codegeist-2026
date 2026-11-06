# Capacity envelope and degradation strategy (gauntlet Q15)

Date: 6 Nov 2026. Rule: no load level is claimed without a dated measurement.
Every line is tagged `MEASURED`, `CODE BOUND`, or `UNKNOWN` (with the experiment that
would resolve it). No 10,000-request claim is made.

## Measured (hosted, dated)

| Measurement | Result | Source |
|---|---|---|
| listProjects burst, 10 parallel, dev | 30/30 pass, p95 1.9 s | EVIDENCE_PACK, 4 Nov |
| getGraphSnapshot burst, 10 parallel, dev | 20/20 pass, p95 2.6 s | EVIDENCE_PACK, 4 Nov |
| First open, production 2.30.0 | ~2.6 s warm, ~3.9 s backend-cold, ~9.3 s post-deploy | EVIDENCE_PACK, 3 Nov (STALE for 2.38.0 — re-measure per JUDGE_RERUN_CHECKLIST) |
| Engine: 100-node, 3-scenario comparison | ~18 ms | TECHNICAL_SECTION (method: local run) |
| Engine ladder, 100 nodes, 2 changes (LOCAL) | simulatePortfolio 11 ms, composeSafeChanges 5 ms, heap +1 MB | `test/engine-scale.test.ts`, 6 Nov, Windows vitest run |
| Engine ladder, 500 nodes, 2 changes (LOCAL) | 2 ms / 4 ms, heap +4 MB | same run (heap deltas are noisy point samples) |
| Engine ladder, 2000 nodes, 2 changes (LOCAL) | 5 ms / 15 ms, heap +0 MB | same run — engine compute is negligible vs Jira I/O + cold starts |

## Code bounds (enforced, tested)

- Evidence crawl: depth ≤ 5, ≤ 200 live nodes, cycle-safe, truncation flagged.
- Portfolio: `PORTFOLIO_LIMITS` (max 10 changes; per-change op cap; unique ids).
- Composer: `COMPOSER_LIMITS` (max 8 candidates, max 3 transforms per kind).
- Contracts: zod on every request/response + payload size caps; oversize rejected.
- Writes: per-plan lease (single executor), idempotency keys, marker reconciliation.
- Throttle: request limits implemented; fail-open on storage errors while every
  operation still enforces its own Jira authorization (decisions.md D7; the 2.31.0
  KVS incident + wiring test are the regression proof).

## Degradation contract (what the caller sees under stress)

| Condition | Response | Retryable |
|---|---|---|
| Rate/quota pressure | `RATE_LIMITED` / `BUDGET_EXCEEDED` | yes, with backoff |
| Jira/Forge unreachable | `UPSTREAM_UNAVAILABLE`, honest unavailable state | yes |
| Storage fault mid-flow | fail-open throttle, fail-closed decisions; timeout reconciles by read-back | reconcile first |
| Validator during outage | admin-chosen policy: Allow (default) or Block | n/a (policy) |
| Unknown evidence | shown as UNKNOWN, never "safe" | n/a |

## Unknown (do not assert; run the experiment)

- Forge invocation quotas/durations for this app's resolvers → verify against current
  Forge quota docs + instrument per-op durations on the shipping build.
- Jira Cloud rate limits encountered at scale → extend dev bursts (20/50 parallel)
  and record the first failure mode with timestamps.
- compareScenarios/executeApprovedPlan under burst + large hosted graphs →
  scorecard Performance gap; burst on dev with a larger demo graph.
- Resolver memory high-water per op (allocation 1024 MB) → profile Q17 protocol.

## Next experiments (in order)

1. Re-measure open timings + per-op p50/p95 on the shipping build (judge re-run day).
2. 20- and 50-parallel bursts on dev; record envelope break point, not just passes.
3. Memory high-water per op; publish headroom in RELEASE.md.
