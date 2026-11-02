# CORE → EXPERIENCE handoff (single source)

## Feature: Continuous Decision Safety — status: DEPLOYED_DEV 4.12.0, VERIFIED_ON_REAL_JIRA (backend)
**Why:** an approved plan must not write to Jira if the dependency evidence changed after the snapshot.

### Wire compatibility
`meta.contractVersion` stays **"0.2.0"** (your client pins it). New things are additive:
- Error code `EVIDENCE_CHANGED` (from `approvePlan` and `executeApprovedPlan`), `error.details = { addedEdges[], removedEdges[], becameUnknown[] }`.
- Plan status `EVIDENCE_CHANGED` (appears in plan/passport reads after a refusal). Please accept it in your status rendering; today it may hit your INVALID_RESPONSE path.
- New read-only resolver `checkPlanFreshness({ planId })` → `EvidenceDrift` (schema in packages/contracts: `fresh`, `addedEdges`, `removedEdges`, `becameUnknown`, `ignoredPlanArtifacts`, `reason`, `checkedAt`).

### Suggested UX (your call)
- Before "Approve" and "Execute": optional "Check evidence freshness" → show FRESH / CHANGED with the diff list (edge `from KIND to [STATUS]`).
- On `EVIDENCE_CHANGED`: explain "Evidence changed since this plan was built — re-run comparison and review a new plan"; offer "Rebuild snapshot". Do **not** offer retry of the same plan (server refuses re-approval: CONFLICT).
- Observed today: after refusal the Plan screen showed "A mutation was requested… No execution records returned" without the reason → please surface `error.code/message/details`.

### States
loading (crawl up to depth 3 / 200 nodes, a few seconds), fresh, changed, PERMISSION_DENIED (other user's plan), SNAPSHOT_EXPIRED, NOT_FOUND.

### Example
`{"planId":"plan-…","snapshotId":"snap-…","checkedAt":"2026-11-02T14:30:00.000Z","fresh":false,"addedEdges":[{"from":"issue:TD-6","to":"issue:TD-1","kind":"DEPENDS_ON","status":"CONFIRMED"}],"removedEdges":[],"becameUnknown":[],"ignoredPlanArtifacts":[],"reason":"Evidence changed since the snapshot: 1 new dependency relation(s). Re-run the comparison and review a new plan."}`

### Tests (CORE)
test/drift.test.ts (6), test/concurrency.test.ts (3).
### Limitations
Detects causal relation changes (DEPENDS_ON/USES/BLOCKS) and readability loss within the snapshot's crawl limits; ignores labels/comments/timestamps and issues created by the plan itself.


## Feature: Judge sample project — status: UNIT_TESTED, DEPLOYED_DEV 4.13.0 (needs your UI)
Goal: a judge on a blank site gets a working demo in a few clicks.
- `previewSampleProject({ projectKey })` → `SampleProjectPlan` (read-only): `canCreate`, `missingPermissions`, `issueType`, `items[6]{role,summary,issueKey,status:TO_CREATE|EXISTS}`, `links[4]`, `rootIssueKey`, `replacementIssueKey`, `note`.
- `createSampleProject({ projectKey, confirm: true })` → same shape with statuses CREATED / EXISTS / FAILED, verified by re-reading Jira. Idempotent (safe to click twice). Never modifies existing issues. Errors: PERMISSION_DENIED (lists missing Jira permissions), VALIDATION.
- Suggested flow: Mission Control empty state ("No projects/candidates") → "Prepare sample data" → choose project → show preview list → explicit confirm button → result → button "Analyze <rootIssueKey>" (prefill root key, and replacement = replacementIssueKey for scenario C).
- Data is labelled `anticipate-sample` + `anticipate-sample-<role>`; root issue also `anticipate-change`, so it appears in change candidates.

## 2 Nov 2026 (evening) - CORE contract additions (backward compatible, wire version still 0.2.0)

- `PreventionPassport.evidence` (optional): `{ state: 'LIVE' | 'EXPIRED_SNAPSHOT' | 'ARCHIVED', capturedAt, expiresAt, nodeCount, edgeCount, causalEdgeCount, snapshotDigest }`. When state is not LIVE the disclaimer starts with "HISTORICAL RECORD". Suggested UI: a "Historical record, evidence as reviewed on <capturedAt>" badge on the Passport.
- `createSampleProject` can now return `CONFLICT` when another creation is running for the same project. Suggested UI: treat like the slow-creation path (re-check by preview, no resubmit).
- Upgrade scenarios: a declared-compatible upgrade without a confirmed test returns uncertainty reason `MISSING_TEST_EVIDENCE` (existing enum value).
- Workflow validator messages changed (expired attestation, links changed, legacy decision). No UI impact.


## EXPERIENCE → CORE requests (v4 UX pass, 2 Nov 2026)
Details and context: `docs/design/UX_AUDIT_V4.md`. No CORE file was changed by EXPERIENCE.
- **R1 — Upgrade capability signal.** Please add the string `scenario:UPGRADE_NODE` to `OPERATION_NAMES` (`src/engine/service.ts`) once `compareScenarios` + `generatePreventionPlan` accept `UPGRADE_NODE` scenarios on the deployed backend. The UI already sends exactly `upgradeScenarios()` (parity unit test) but keeps "Upgrade a dependency" disabled until this signal is present. Purely additive; contract version unchanged.
- **R2 — Real Rovo/MCP availability.** `getCapabilities` hard-codes `rovoAgent` and `rovoMcp` as `NOT_CONFIGURED`, but EVIDENCE_PACK records a verified Rovo chat on dev 4.19.0. If availability can be determined, report it; otherwise keep NOT_CONFIGURED (the UI shows backend truth either way).
- **R3 — Hosted acceptance.** After deploying `main`: Mission Control guided demo + "Start demo" button, Display & accessibility menu (theme override inside the Jira iframe), Scenario Lab change-kind picker (upgrade disabled until R1).
- **R4 — Evidence coverage.** Fill the optional `GraphSnapshot.coverage` (`JIRA`, and `TEAMWORK_GRAPH` when attempted) with FULL / PARTIAL / UNAVAILABLE / NOT_CONFIGURED and a short `detail`. The Evidence Graph "Evidence sources" strip renders it as is; until then it shows Jira only plus the `teamworkGraph` capability state.
- **R5 — Hosted performance reading.** After deploying, open ANTICIPATE on dev and prod (cold and warm), run one analysis and comparison, then Settings → Performance in this session → Download timings JSON. Commit the files under `evidence/experience/v4-ux/` labelled LIVE_FORGE so EXPERIENCE can target the real bottleneck (frame start vs. `getCapabilities` vs. `getGraphSnapshot`).
