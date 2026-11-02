# CORE integration requirements — EXPERIENCE milestone

Status: frontend handoff prepared; live integration BLOCKED. These are definitive frontend requirements for CORE review, not an assertion that CORE has implemented or accepted a contract. No guessed resolver bindings, deployment, push or Jira mutation.

## Contract sources

`static/hello-world/src/api/core-handoff.ts` exports named TypeScript payload aliases and complete `CoreOperationInputs` / `CoreOperationOutputs` maps. `provisional-contracts.ts` supplies runtime Zod schemas and error codes. `AnticipateClient.request` deliberately returns unknown at the transport boundary until CORE publishes reviewed `packages/contracts`. `ForgeClient.coreBindings` remains empty. Replace proposals with reviewed contracts rather than cast unknown data into fixture success.

## Operations and authorization

| Operation | Input | Output / server obligation |
| --- | --- | --- |
| getCapabilities | empty | Forge mode, reviewed version, enabled operation allowlist, installed integrations, genuine launch URL or null |
| getProjects | empty | Only projects visible to the current authenticated installation/user; empty list is valid |
| getProjectSnapshot | projectId | Immutable project/change snapshot, id, capturedAt, mode/disclosure; enforce project access |
| getEvidenceGraph | snapshotId | Root, services and explicit relationships with evidence/freshness/provenance; enforce snapshot ownership |
| simulateChange | snapshotId, scenarioId | Simulator result with the same snapshot, scenario and source=simulator |
| compareScenarios | snapshotId | Complete unique A/B/C results with same snapshot and source=simulator |
| generatePreventionPlan | snapshotId (current input) | Versioned plan with individual targets, reasons, evidence, permission, verification rule, approval states |
| approvePreventionPlan | planId, version, actionIds | Authoritative updated plan; authorize each target/action; approval alone performs no Jira write |
| executeApprovedPlan | planId, version, actionIds, idempotencyKey | Durable execution record; accept only approved eligible actions; authorization and duplicate prevention on server |
| getExecutionStatus | executionId OR idempotencyKey | Same execution and per-action attempts, errors and verified outcomes; never enqueue a second execution |
| getPreventionPassport | snapshotId, scenarioId | Same decision snapshot/scenario, evidence, mitigations, uncertainty and genuine approval/execution audit |

Never trust browser capability flags, action IDs, a checkbox, supplied URLs, or frontend role labels as authorization. Derive installation, tenant and user from authenticated Forge context; enforce project access and per-action Jira permissions on each read/write. Deny cross-tenant snapshots/plans/execution keys. Recheck version, freshness and approval immediately before writes. Keep secrets and raw upstream errors out of frontend payloads. CORE owns scopes, manifest, context validation and audit retention.

## Snapshot and concurrency rules

Use one immutable snapshot for graph, comparison, plan and passport. Never join results from different snapshots. Current frontend rejects read-mode/source mismatches and snapshot mismatches; Passport also rejects scenario mismatch. A refreshed snapshot must invalidate selected actions, approvals and executions attached to previous data. Plan version is an optimistic concurrency token; CORE must reject stale approval/execution atomically. Expired or inaccessible snapshots must not silently become demo data.

Execution keys must be durable and scoped to installation/user/plan/version/selected actions. Repeating a key returns the original execution; changing payload under the same key must fail. A timeout/consumer abort stops observation, not a server write. Frontend retains a request key and requires status inspection; no automatic mutation retry. PARTIAL/FAILED is never SUCCEEDED; only individually VERIFIED actions are verified outcomes.

## Explicit errors and states

| Code/state | Frontend behavior / required CORE meaning |
| --- | --- |
| UNSUPPORTED / PENDING_BACKEND | Missing reviewed bindings/capabilities; display pending integration, no fallback |
| FORBIDDEN | Permission denied; no invented empty success or mutation |
| SNAPSHOT_EXPIRED | Reload evidence and regenerate/review plan; never reuse approval |
| INVALID_RESPONSE | Runtime schema/mode/provenance mismatch; reject payload |
| NETWORK_ERROR | Bridge failure or currently unmapped backend rejection; success remains unknown |
| TIMEOUT | 12-second observation bound; status inspection before any new write |
| UNAVAILABLE | Resource unavailable; explicit error/retry state |
| REQUIRES_LIVE_BACKEND | Fixture mutation rejected; no Jira action performed |
| loading / empty / error | Separate states; empty project/evidence lists are valid, retry is explicit |
| PENDING / RUNNING / PARTIAL / FAILED / SUCCEEDED | Execution states with per-action PENDING/RUNNING/FAILED/VERIFIED; no inferred completion |

Current transport preserves structured FORBIDDEN/SNAPSHOT_EXPIRED and frontend ClientError instances. Other remote error objects become NETWORK_ERROR. CORE must agree an error envelope and add mapping/tests before binding resolvers. Version conflict, invalid input, not-found, throttling/retry-after and idempotency conflict need reviewed codes; do not treat this list as an already complete backend taxonomy.

## Release gates and known contract gaps

- Production currently shows only Forge capability/access UI, not the seven-screen fixture prototype. Wire shared screen composition to the real client only after reviewed payloads, auth and error handling pass hosted tests.
- Plan generation currently has no scenario input and fixture plans exist only for C. CORE must agree scenario/decision identity on plan, execution and passport, then frontend must carry and validate it end to end. A/B correctly display no authored plan. This is a release blocker, not simulated plan generation.
- Passport `comparedScenarios` remains unknown and execution is a display string. Agree structured comparison, audit actor/event references, plan version and execution linkage; verify exports match authoritative records. Fixture timeline is empty.
- Graph pages are client-side: up to 10,000 loaded dependencies / 30,000 relationships; drawn window at most 41 nodes / 80 edges. Agree server cursor/filter/group semantics for larger or dense graphs, plus real freshness thresholds. Synthetic sparse-star measurements do not cover dense topology.
- Agree plan version conflict handling, status lookup retention and authorization, retry eligibility, approver identity, snapshot TTL/revocation and genuine source links. Runtime schema validity alone cannot prove authenticity.

## CORE acceptance sequence

1. Publish reviewed contracts/resolver identifiers and compatibility version; add representative payload/error fixtures to boundary tests.
2. Verify authenticated empty, forbidden, expired, malformed, partial and unavailable responses without fixture fallback.
3. On an authorized Forge development site, verify host routing, Bridge/CSP/theme and tenant isolation with two permission levels; provide a genuine installation/launch URL.
4. Run one real snapshot through graph → comparison → scenario-bound plan → explicit selected approval → separate execution → status → linked Passport. Verify the actual Jira outcome and audit records independently.
5. Exercise duplicate execution key, stale plan, timeout after server commit, partial failure and denied permissions. Never retry a write based only on a missing response.

Local tests support frontend review readiness only. Hosted acceptance remains entirely unverified while CORE is unavailable.
