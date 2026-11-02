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

## Update 2026-11-02 02:10 UTC
Your `d9d6109` (merge of CORE + CoreWorkspace) was built from a detached integration worktree and **deployed to development as v4.3.0**.
No CORE incompatibility found (backend tests pass on your tree, your branch touches no CORE paths). Hosted user-context validation is pending an authenticated browser session.

## Update 2026-11-02 08:30 UTC
Reviewed `6e9fad2` (CoreOperationError refinement, cursor paging coverage). No CORE-owned files changed, contract 0.2.0 unchanged → no CORE-side action needed.
Your note says deployment of this follow-up was explicitly deferred by its owner, so CORE did **not** deploy it; development still runs the `d9d6109` build (v4.3.0). Tell CORE (via this file or status-experience.json) when you want it deployed.

## Response to DEPLOYMENT_REQUEST_EXPERIENCE (2026-11-02 12:15 UTC) — DEPLOYED (development)
- Source SHA: `4c68d90fc0990b751cb7bfa7dc6d0f2a77f60c12` (fresh detached checkout in `E:\Codegeist2026\ANTICIPATE-INTEGRATION`, `npm ci` root + frontend, fresh `npm run build`, CORE tests 18/18 on that tree).
- Environment: **development** only. App `ari:cloud:ecosystem::app/39a28f48-c891-4d86-a3cf-c14409cbd29e`, installation `2ae8efdf-84b8-4851-a341-e4fa2499595c` (development, one-atlas-euza.atlassian.net, verified via `forge install list`). Deployed version **4.8.0**. Manifest unchanged (no web triggers, no new scopes).
- Identity: deployed by CORE's bridge on the project owner's PC with the Forge CLI session of the app owner (the app owner in the developer console) — the only identity with deploy access to this app; done at the project owner's explicit request. No token was read, copied or transferred. If you need a different identity for future deployments, say so here.
- Launch URL: https://one-atlas-euza.atlassian.net/apps/full-page/2ae8efdf-84b8-4851-a341-e4fa2499595c/hello-world/
- Read-only smoke (authenticated owner session, built-in browser): capabilities check → Mission Control rendered; project list loaded; plan recovery of `plan-a2f3db9f-…` returned status COMPLETED with per-action records. No seed, deletion or Jira write performed in this smoke.
- Earlier today (before this request, owner-authorized): full P0 flow on TD-1 with 6/6 VERIFIED writes (TD-7/TD-8 created, labels, decision comment) — see AVANCEMENT.md.
- Production currently runs 2.0.0 (CORE 6356a28 backend + your d9d6109 build). Production with 4c68d90 is NOT done (outside your request); the project owner has authorized production deploys — tell CORE when your build is ready for production.

## Response to PRODUCTION_GO_EXPERIENCE (b14e128) — 2026-11-02 12:50 UTC
- Production was already deployed from the exact source `4c68d90fc0990b751cb7bfa7dc6d0f2a77f60c12` at ~12:29 UTC on the project owner's direct instruction: **production 2.1.0** (previous production 2.0.0 = CORE 6356a28 + EXPERIENCE d9d6109 build, kept as rollback reference in the developer console deployment history).
- Production installation: **none yet** — `forge install list` shows only the development installation `2ae8efdf-…`. No production install was created; judges will install via the distribution link.
- Identity: same as the development deployment — the Forge CLI session of the app owner on the project owner's PC; no token was handled. CORE cannot certify this meets your identity requirement; please confirm or name the identity you expect. No further production action will be taken on your builds until you confirm (development deployments continue on request).
- Distribution/sharing: NOT changed. Blocked on a public privacy-policy URL and a support contact (drafts in docs/legal/).

## Hosted validation of PR #4 (e4f3235) — 2026-11-02 14:00 UTC
Your browser blocker (CryptUnprotectData) is on your machine (Chrome cookie decryption), not in the app. CORE ran the hosted validation instead:
- Fresh checkout `e4f32352a5b4bf5eb49ad49cd96adbe89599fbf6`, `npm ci` root + frontend, build, CORE tests 19/19.
- Deployed **development 4.10.0**; authenticated read-only smoke on one-atlas-euza: Mission Control → TD → TD-1 → evidence snapshot (8 nodes, 7 relations, all expected statuses). No Jira write.
- PR #4 merged into `main`; same source promoted to **production**.
Tip for your agent: use a browser profile where Atlassian login works (or a fresh profile) — CryptUnprotectData usually means Chrome cannot decrypt the stored cookies of that Windows user profile.

## 2 Nov 2026 - hosted test of PR #9 sample data

Works end to end on dev (project MP): 6 issues + 4 links, re-preview EXISTS, analysis of the root OK.
One request: `createSampleProject` can take about 15-20 s (12 sequential Jira writes plus verification). The UI showed "TIMEOUT: Response not received" although everything was created. Please raise the timeout for this operation to 60 s, or show "may still be running, re-preview to check".
CORE change: projects where the user cannot create issues (e.g. service desk without platform create rights) now return canCreate=false in the preview.

## 2 Nov 2026 - PR #14 (UI v3) hosted validation: PASSED, merged, in production

- Built from 653d164 (frontend 47, CORE 43 tests green), deployed dev, then production.
- Evidence drift refusal: plan-4ac3c031 recovered, banner "Evidence changed - this plan cannot execute", every action flagged, "Rebuild snapshot" offered.
- Demo data on MP: preview shows 6 items + 4 links EXISTS; create re-run is idempotent and returned without timeout; "Analyze MP-5" opens the Evidence Graph (MP-6, MP-7 depends on, MP-9 inferred).
- Production (judges' site) loads UI v3. First paint can take about 20 s on a cold start.
- Still open: timeout on first-time creation (about 15-20 s server side) when all 12 writes are needed.
