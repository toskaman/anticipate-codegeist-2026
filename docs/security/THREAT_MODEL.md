# Threat model (v0.3, updated 3 Nov 2026 after PRs #84 and #86)

| Threat | Mitigation (implemented) | Residual |
|---|---|---|
| Tenant crossover | Forge storage is per installation; all Jira calls `asUser()` | — |
| User crossover inside a site | snapshots/plans store `owner` accountId; reads by others → PERMISSION_DENIED | Shared team plans not supported yet |
| Authorization bypass via UI | resolvers validate input (zod), re-check `mypermissions` before writes; UI state never trusted | — |
| Replay / double execution | approval idempotency key; per-plan lease (`FAIL_IF_EXISTS`); per-action records; marker-label/comment reconciliation before any create | Lease is not a distributed transaction; marker search depends on Jira index freshness |
| Stale decisions | plan hash bound to approval; 24h snapshot TTL; expired → SNAPSHOT_EXPIRED / EXPIRED plan; validator attestations valid 14 days and bound to a digest of the issue links (`src/validator.ts`) | — |
| Malicious Jira content | content treated as data; ADF text nodes only (no markup interpretation); labels/keys regex-validated before JQL | UI must render text safely (EXPERIENCE) |
| JQL injection | projectId/keys validated by regex before interpolation | — |
| Cost exhaustion | depth ≤5, nodes ≤200, scenarios ≤5, ops ≤50, actions ≤50, attempts ≤5; slip crawl ≤50 issues (`SLIP_MAX_ISSUES`); at most 5 parallel Jira reads per crawl batch (`CRAWL_FETCH_CONCURRENCY`, `src/jira/extractor.ts:19`); no polling; no LLM calls | Up to 4 extra reads when a crawl hits its node cap mid-batch |
| Secret leakage / personal data in logs | no secrets in code; logs contain op/requestId/code/duration, plus the admin **accountId** on outage-policy changes (`src/engine/service.ts:168`) and a ≤200-char outage detail in validator logs (`src/validator.ts:67`) | Old CLI token must be revoked by owner; accountId in logs is personal data (disclosed in PRIVACY.md) |
| Demo data mistaken for real | fixture snapshot id prefix → `meta.mode = DEMO_FIXTURE`; fixture plans cannot execute | — |
| Dev-only endpoints exposed in production | `diagnostics`/`seedDemo` and the legacy `getText` resolver are no longer exported from the Forge entry or the manifest; a gate test fails if they come back (`test/diagnostics-gate.test.ts`); the module also refuses to run when `NODE_ENV=production` | The `NODE_ENV` guard is defence in depth only |
| Wrong-direction link counted as verified | ADD_ISSUE_LINK and CREATE_ISSUE link checks match the other issue and link type | Direction is not checked (`src/engine/service.ts`, ADD_ISSUE_LINK branch); no planner emits ADD_ISSUE_LINK today (see review on PR #84) |
| Prompt injection via Rovo | actions are read-only, deterministic, no LLM inside ANTICIPATE | Rovo's own model behaviour is out of scope |

## Dependency advisory: zod < 4.6.6 (GHSA-mrhx-c7xc-m3w5) - REMEDIATED (3 Nov 2026)
Backend, contracts and simulation engine now use zod 4.6.7 (frontend already did). All tests unchanged and green (backend 73, contracts 3, engine 11), typecheck clean. The 64 000-character payload bound before schema parsing stays as defence in depth.
