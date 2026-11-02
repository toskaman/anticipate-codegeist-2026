# CORE → EXPERIENCE: answers to frontend-integration-requests v2 (2026-11-02)

Everything below is **deployed on development** (`one-atlas-euza.atlassian.net`, installation `2ae8efdf-84b8-4851-a341-e4fa2499595c`, routePrefix `hello-world`).
Launch URL: `https://one-atlas-euza.atlassian.net/apps/full-page/2ae8efdf-84b8-4851-a341-e4fa2499595c/hello-world/`

## How to adopt
`git merge origin/feat/core-engine` into `feat/product-experience` (no overlap with `static/hello-world/**`), then import
`../../../packages/contracts/src/index` (zod schemas + `OPERATIONS` input/output map) instead of `provisional-contracts.ts`.
Fixtures that exactly match: `packages/contracts/src/fixtures.ts`.

## Resolver map (exact `invoke()` keys)
| Your proposed op | CORE resolver | Input (zod in `OPERATIONS`) | Notes |
|---|---|---|---|
| getCapabilities | `getCapabilities` | `{}` | per-capability state AVAILABLE / NOT_CONFIGURED / UNSUPPORTED / PERMISSION_REQUIRED / DISABLED_BY_BUDGET + `operations[]` |
| getProjects | `listProjects` | `{ cursor }` | `page.nextCursor`; `[]` is valid |
| (change list) | `getChangeCandidates` | `{ projectId, cursor }` | issues labelled `anticipate-change` |
| getProjectSnapshot | `getGraphSnapshot` | `{ projectId, rootIssueKey, source?: 'JIRA'\|'DEMO_FIXTURE', maxDepth? }` | returns immutable `GraphSnapshot` (snapshotId, createdAt, expiresAt=+24h, truncated, limits) |
| getEvidenceGraph | `getEvidenceGraph` | `{ snapshotId }` | same snapshot; `SNAPSHOT_EXPIRED` after TTL. Server bounds: depth ≤5, 200 nodes (pagination not needed at this size) |
| simulateChange | `simulateChange` | `SimulationRequest` | deterministic; `resultHash` per scenario |
| compareScenarios | `compareScenarios` | `SimulationRequest` (1–5 scenarios) | results + per-scenario diff + recommendation (lowest risk now, not "best") |
| generatePreventionPlan | `generatePreventionPlan` | `{ snapshotId, scenarioId }` | requires a prior compareScenarios on that snapshot; `planHash` = version |
| approvePreventionPlan | `approvePlan` | `{ planId, planHash, approvedActionIds, idempotencyKey }` | stale hash → `STALE_APPROVAL`; reviewer accountId + time recorded server-side |
| executeApprovedPlan | `executeApprovedPlan` | `{ planId, idempotencyKey }` | per-plan lease (`CONFLICT` if running); per-action records; verified after write |
| getExecutionStatus | `getExecutionStatus` | `{ planId }` | **lost-response recovery: look up by planId** (you always have it); statuses PENDING/CLAIMED/SUBMITTED/VERIFIED/FAILED/SKIPPED + attempt + resultRef(Jira URL) + error |
| getPreventionPassport | `getPreventionPassport` | `{ planId }` | snapshot, comparison, plan, approvals, executions, openUnknowns, timeline, disclaimer |
| — | `getPolicies` | `{}` | read-only rules P1–P3 (enforced inside ANTICIPATE only) |

## Envelope & errors
`{ ok: true, meta: { contractVersion: '0.2.0', requestId, mode: 'LIVE'|'DEMO_FIXTURE', generatedAt }, data }` or
`{ ok: false, meta, error: { code, message, requestId, retryable, details? } }`.
Codes: PERMISSION_DENIED (your FORBIDDEN), NOT_FOUND, VALIDATION, SNAPSHOT_EXPIRED, STALE_APPROVAL, CONFLICT, RATE_LIMITED,
UPSTREAM_UNAVAILABLE (your NETWORK_ERROR server-side), UNSUPPORTED, TIMEOUT, BUDGET_EXCEEDED, INTERNAL. Client-side network/invalid
response errors stay in your client. A timed-out execute → call `getExecutionStatus({planId})`, never resubmit blindly (re-execute is safe anyway: verified actions are skipped, marker-based reconciliation prevents duplicate issues).

## Graph shape vs your provisional one
Nodes `{ id, kind: ISSUE|PROJECT|COMPONENT|SERVICE|RELEASE|TEST|DOCUMENT|DECISION, label, status: CONFIRMED|INFERRED|UNKNOWN, attributes, references[] }`,
edges `{ id, from, to, kind: DEPENDS_ON|BLOCKS|USES|VERIFIED_BY|DOCUMENTED_IN|AFFECTS, status, references[{ sourceSystem, sourceId, url, extractor, observedAt }], accessLimited }`.
Direct vs transitive and provenance paths come from `SimulationResult.impacts[{ nodeId, depth, direct, pathEdgeIds, weakestStatus }]`.
Freshness = snapshot `createdAt/expiresAt` (no per-edge staleness yet).

## Scenario ids for the flagship flow
Node ids are `issue:<KEY>`. A = `REMOVE_NODE`, B = `DEPRECATE_NODE`, C = `MIGRATE_DEPENDENTS(from,to,['USES','DEPENDS_ON'])` + `REMOVE_NODE`.

## Verified on real Jira (read paths, as app)
projects, JQL search (`/rest/api/3/search/jql`), issue + links, permissions, issue types, graph extraction on real `Blocks` / `Relates` links.
Not yet verified: user-context calls from your UI, real writes — that is our next joint gate.

## Also live
Rovo MCP module `anticipate-mcp` (3 read-only tools) deployed to development. External MCP clients require admin enablement.
