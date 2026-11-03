# Threat model (v0.2)

| Threat | Mitigation (implemented) | Residual |
|---|---|---|
| Tenant crossover | Forge storage is per installation; all Jira calls `asUser()` | — |
| User crossover inside a site | snapshots/plans store `owner` accountId; reads by others → PERMISSION_DENIED | Shared team plans not supported yet |
| Authorization bypass via UI | resolvers validate input (zod), re-check `mypermissions` before writes; UI state never trusted | — |
| Replay / double execution | approval idempotency key; per-plan lease (`FAIL_IF_EXISTS`); per-action records; marker-label/comment reconciliation before any create | Lease is not a distributed transaction; marker search depends on Jira index freshness |
| Stale decisions | plan hash bound to approval; 24h snapshot TTL; expired → SNAPSHOT_EXPIRED / EXPIRED plan | — |
| Malicious Jira content | content treated as data; ADF text nodes only (no markup interpretation); labels/keys regex-validated before JQL | UI must render text safely (EXPERIENCE) |
| JQL injection | projectId/keys validated by regex before interpolation | — |
| Cost exhaustion | depth ≤5, nodes ≤200, scenarios ≤5, ops ≤50, actions ≤50, attempts ≤5; no polling; no LLM calls | — |
| Secret leakage | no secrets in code; logs contain op/requestId/code/duration only | Old CLI token must be revoked by owner |
| Demo data mistaken for real | fixture snapshot id prefix → `meta.mode = DEMO_FIXTURE`; fixture plans cannot execute | — |
| Prompt injection via Rovo | actions are read-only, deterministic, no LLM inside ANTICIPATE | Rovo's own model behaviour is out of scope |

## Dependency advisory: zod < 4.6.6 (GHSA-mrhx-c7xc-m3w5) - REMEDIATED (3 Nov 2026)
Backend, contracts and simulation engine now use zod 4.6.7 (frontend already did). All tests unchanged and green (backend 73, contracts 3, engine 11), typecheck clean. The 64 000-character payload bound before schema parsing stays as defence in depth.
