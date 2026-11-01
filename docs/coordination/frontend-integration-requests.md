# Frontend integration requests — EXPERIENCE v2

Status: PENDING CORE REVIEW. These are proposed logical operations, not existing resolver identifiers. The fetched origin/feat/core-engine baseline f898235 contains only the template resolver. Do not deploy or modify the manifest from EXPERIENCE.

## Contract needed before live screens

Please publish packages/contracts/src/index.ts and docs/coordination/status-core.json with the exact schema version, resolver map, supported operations and permission/capability behavior. EXPERIENCE currently has no configured resolver bindings; the production app shows PENDING_BACKEND and never substitutes fixtures.

| Operation | Required input | Required authoritative output |
|---|---|---|
| getCapabilities | Installation context established server-side | contractVersion, enabled operations, integrations, access/launch capability; no inferred privileges |
| getProjects | Optional cursor/search | Accessible project IDs/names, pagination; empty is a valid result |
| getProjectSnapshot | projectId, selected issue/change ID | Immutable snapshotId, capturedAt, freshness, issue, available evidence and source metadata |
| getEvidenceGraph | snapshotId, cursor/bounds | Nodes and edges with stable IDs, source URLs, provenance paths, epistemic state, stale status, relation type and direct/transitive scope |
| simulateChange | snapshotId, typed proposed changes, draft revision | Deterministic result, same snapshotId/revision, violations, blockers, affected nodes, missing evidence, mitigations; no invented probabilities |
| compareScenarios | snapshotId, at least three typed alternatives | Results and readable deltas tied to the same immutable snapshot |
| generatePreventionPlan | snapshotId, selected resultId | planId/version, action IDs, target, reason, evidence, permission and verification rule |
| approvePreventionPlan | planId/version, actionIds, explicit approval | Per-action authoritative approval state and reviewer/time; reject stale plans |
| executeApprovedPlan | planId/version, approved actionIds, idempotencyKey | executionId and accepted action states, no success until verified |
| getExecutionStatus | executionId, optional cursor | PENDING/RUNNING/PARTIAL/FAILED/SUCCEEDED; per-action attempt, verified outcome/Jira URL or error, retry safety, audit events |
| getPreventionPassport | planId/executionId | Decision, immutable snapshot, alternatives, provenance, approvals, attempts, verified outcomes and unresolved unknowns |

## Error and security semantics

Agree an error envelope containing stable code, safe message, retryable flag, correlation ID and optional refreshed snapshot/action status. Required cases: FORBIDDEN, expired permission, SNAPSHOT_EXPIRED, NETWORK_ERROR, UNSUPPORTED, INVALID_RESPONSE and execution conflict/partial failure. A timed-out write must prompt status inspection, not automatic resubmission. CORE must validate all IDs, installation context and authorization; view.getContext is not proof of permission.

ForgeClient currently supports explicit resolver bindings, response validation for capabilities/projects, timeout and cancellation of observation. Bridge invocation cannot guarantee cancellation of a server-side write; that requires backend state/idempotency. Remaining payloads intentionally return unknown until schema agreement. FixtureClient refuses live approvals, execution and execution-status claims. The previous local prototype remains a development harness and is not the production client.

## Acceptance gates with CORE

1. Validate fixtures and actual responses against the SAME shared schemas.
2. Run a clean Jira site: authorized empty result, inaccessible project, expired snapshot and delayed response.
3. Compare three distinct changes against one snapshot; confirm reproducible expected results.
4. Approve individual actions, reject unauthorized/stale approvals, submit duplicate requests and verify idempotency server-side.
5. Observe partial failure and retry only allowed failed actions without duplicating verified Jira writes.
6. Export the exact backend audit timeline; unknown evidence remains explicit.
7. CORE deploys development; EXPERIENCE verifies full-page URL, Bridge, CSP, host theme and actual Jira outcomes. No production deployment or public submission is authorized by this request file.

## Access information needed

Verified installation link, site hostname, installation UUID, environment, owner-approved development test account permissions and launch URL. Existing routePrefix is hello-world. Do not invent an Apps-menu entry or distribution URL.
