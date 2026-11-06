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

## Documented platform facts (retrieved 6 Nov 2026)

Sources: `https://developer.atlassian.com/platform/forge/limits-invocation/`,
`https://developer.atlassian.com/platform/forge/limits-kvs-ce/`.
These are platform ceilings, not measured app behavior.

| Fact | Value | Implication for this app |
|---|---|---|
| User-led invocations | 1,200/min per user, 7,000/min + 300/sec per install (fixed 1-min window) | Judge/owner traffic is orders of magnitude below; bursts are the test, not the ceiling |
| Resolver runtime | 25 s standard (55 s web-trigger/action/agentConnector; 900 s async/scheduled via timeoutSeconds) | Measured p95 2.6 s has ~10x headroom; the 25 s bound is the per-op budget |
| Memory | 1,024 MB max, 512 MB default (`memoryMB` in manifest) | Manifest already sets 1024 MB; LOCAL engine deltas are single-digit MB |
| Payloads | 5 MB invocation; front-end request 500 KB / response 5 MB | Contract size caps sit far below; large-graph responses are the watch item |
| Network (incl. `requestJira`) | 3M req/min/app, 100K req/min/app/tenant | Jira crawl pagination, not the platform cap, bounds graph reads |
| KVS (per install) | 4,000 read + 4,000 write units/min (10 KB rounding); key ≤ 500 chars; value ≤ 240 KiB; 12 MB/s reads, 1 MB/s writes per key | Snapshot/plan payloads must stay under 240 KiB per value — measure the largest hosted snapshot (experiment 4) |
| KVS transactions | ≤ 25 ops, unique keys, ≤ 4 MB payload | Approval/execution multi-writes already stay within a handful of keys |

## Degradation contract (what the caller sees under stress)

| Condition | Response | Retryable |
|---|---|---|
| Rate/quota pressure | `RATE_LIMITED` / `BUDGET_EXCEEDED` | yes, with backoff |
| Jira/Forge unreachable | `UPSTREAM_UNAVAILABLE`, honest unavailable state | yes |
| Storage fault mid-flow | fail-open throttle, fail-closed decisions; timeout reconciles by read-back | reconcile first |
| Validator during outage | admin-chosen policy: Allow (default) or Block | n/a (policy) |
| Unknown evidence | shown as UNKNOWN, never "safe" | n/a |

## Unknown (do not assert; run the experiment)

- Per-op durations on the shipping build (quotas now documented above) → instrument
  getGraphSnapshot/simulatePortfolio/composeSafeChanges/approvePlan/execute on the judge re-run day.
- Jira Cloud rate limits encountered at scale → extend dev bursts (20/50 parallel)
  and record the first failure mode with timestamps.
- compareScenarios/executeApprovedPlan under burst + large hosted graphs →
  scorecard Performance gap; burst on dev with a larger demo graph.
- Resolver memory high-water per op (allocation 1024 MB) → profile Q17 protocol.

## Next experiments (in order)

1. Re-measure open timings + per-op p50/p95 on the shipping build (judge re-run day).
2. 20- and 50-parallel bursts on dev; record envelope break point, not just passes.
3. Memory high-water per op; publish headroom in RELEASE.md.
4. Measure the largest hosted snapshot/plan payload against the 240 KiB KVS value cap.
