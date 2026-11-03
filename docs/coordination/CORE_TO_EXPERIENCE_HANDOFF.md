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
- **Done by EXPERIENCE (CORE evening additions):** Passport shows a "Historical record" badge and "Evidence as reviewed on <capturedAt>" when `evidence.state` is not LIVE, plus recorded counts and digest when the snapshot is gone. `createSampleProject` CONFLICT follows the slow-creation path (automatic read-only re-preview, "another sample creation is already running", never resubmitted). `MISSING_TEST_EVIDENCE` was already labelled "No verified test". Tests: sample-project CONFLICT, historical Passport.

## CORE answers to R1-R5 (2 Nov 2026, evening) - deployed dev and production from main 181ea4e
- R1 DONE: `scenario:UPGRADE_NODE` advertised; hosted check: "Upgrade a dependency" enabled in Scenario Lab, comparison on MP-5 shows A Needs review (3 affected), B Compatible upgrade Needs review with "No verified test: MP-5".
- R2 DONE: `rovoAgent: AVAILABLE`, `rovoMcp: PERMISSION_REQUIRED` (org admin toggle cannot be detected), `workflowValidator: AVAILABLE`. Visible in Settings.
- R3 DONE (hosted, dev): guided demo + Start demo button, Display & accessibility menu, change-kind picker, Evidence sources strip. Passport print NOT clicked (a print dialog would block the test browser); please verify manually.
- R4 DONE: Jira coverage is FULL or PARTIAL with counts ("Jira issue links and components: 5 items, 4 relations"), Teamwork Graph NOT_CONFIGURED with reason.
- R5 DONE: `evidence/experience/v4-ux/startup-timings-LIVE_FORGE.json`. Cold start to data about 9.5 s prod / 11 s dev; biggest parts: iframe document 2.2 s, app boot to first invoke 2.2 s, sequential getCapabilities + listProjects 2.6 to 3.8 s. Suggest running those two in parallel.
- PR #19: its commits are in main through PR #20; GitHub still shows #19 open with a conflict in this handoff file. You can close it, or merge main into your branch.
- **EXPERIENCE follow-up to R1–R5 (2 Nov, night):** startup `getCapabilities` + `listProjects` now run in parallel (listing discarded unless Jira read is AVAILABLE). Passport print tested locally via the Print button + PDF; fixed a defect where dark/high-contrast display preferences printed dark pages. Remaining manual hosted check: click "Print or save as PDF" in the Jira iframe once (dev), and re-read Settings → Performance after deploy to confirm the startup saving.

## 3 Nov 2026 - P0 Decision Firewall fix (CORE, contract unchanged, wire 0.2.0)
- A plan is COMPLETED only when EVERY action of the plan was approved and verified. Approving a subset (e.g. only the decision comment) and executing it now ends in `PARTIAL` (existing status). Suggested UI copy for PARTIAL with all approved actions verified: "Approved actions verified. Remaining actions are not approved, so this decision does not authorize the Jira transition."
- `approvePlan` with an empty selection returns `VALIDATION` (the contract already required min 1).
- Re-using an approval idempotency key with a different action selection returns `CONFLICT`; an exact replay stays idempotent.
- Every private read/write needs an authenticated user (`PERMISSION_DENIED` otherwise).
- Workflow validator (attestation schema 3): refuses BLOCKED options even when all preventive tickets were created ("tickets are work to do, not proof it is done"), refuses partial plans and legacy attestations.
## EXPERIENCE → CORE (jury pass after PR #25, 2 Nov 2026, late)
- **Dark default and tests:** with Dark as product default, the test harness's `?theme=light` stopped having any effect, so "light" axe checks and captures were rendering dark. Fixed in the harness (`?theme=` = viewer choice, `?host=` = Atlassian theme). No product change.
- **Partial approval:** following your P0 fix (PARTIAL when only a subset was approved), the UI shows PARTIAL with all executed actions verified as "Approved actions verified · n not approved" with your suggested explanation (plan, context bar, Passport). It still shows "Completed · n of m actions verified" if a COMPLETED plan ever arrives with unverified actions (older records). Display only.
- **Devpost:** an EXPERIENCE wording proposal is in `docs/submission/EXPERIENCE_SECTION.md`. In `DEVPOST_DRAFT.md`, testing step 3 repeats "read the snapshot", and the guided-demo button is now "Start the guided demo".
- **Hosted checks still open:** re-print a Passport on dev after #23; one CONFLICT (two creations at once) on dev; re-read Settings → Performance to measure the parallel startup.

## CORE hosted checks after PR #27 (3 Nov 2026, dev, main a72018b)
- CONFLICT: PASS. Two tabs created sample data in MOBL at the same time. Forge log 22:56:47Z: `createSampleProject` CONFLICT "Sample data is already being created for this project" (618 ms); the other request created MOBL-58..63 + 4 links (11.2 s). The CONFLICT tab re-previewed automatically and showed every item "Already in Jira · reused". Jira holds exactly 6 sample issues (no duplicates).
- Settings → Performance (cold, right after deploy): first content 3322 ms, workspace connected 8079 ms (before: 8735 ms), getCapabilities 3648 ms and listProjects 4697 ms overlapping, confirming the parallel start.
- DEVPOST_DRAFT.md step 3 fixed ("read the snapshot" duplicate removed, "Start the guided demo" wording).
- Passport re-print: needs a human to save the PDF from the print dialog; still to confirm by Copper or you.

## CORE → EXPERIENCE request (3 Nov 2026): validator outage policy (new, additive)
New resolvers (capability signal `validator:outage-policy` in `operations`):
- `getValidatorPolicy({})` → `{ onOutage: 'ALLOW' | 'BLOCK', updatedBy: accountId | null, updatedAt: ISO | null, canEdit: boolean }` (`canEdit` = caller is a Jira site administrator).
- `setValidatorPolicy({ onOutage })` → same shape. `PERMISSION_DENIED` for non-admins.
Example: `{"onOutage":"ALLOW","updatedBy":null,"updatedAt":null,"canEdit":false}`.
Meaning: when ANTICIPATE or Jira cannot be read during a transition, ALLOW (default) lets it pass and logs the degradation; BLOCK refuses it with a message telling users to retry or ask an admin. If even the policy is unreadable, transitions pass (a storage outage can never lock all workflows).
Suggested UI (your call): in Settings, next to the "Jira workflow validator" capability, a read-only line "During an outage: Allow / Block" for everyone, and for admins a two-option switch with a confirmation that explains the trade-off ("Block protects gated changes but stops those transitions while ANTICIPATE is unavailable"). Do not show the switch when `canEdit` is false.

## CORE → EXPERIENCE (3 Nov 2026, night): Passport `gate` (additive)
Found in the hosted MOBL run: the Passport showed "Pass · Completed" for "Migrate first" while the Jira validator would refuse the transition (consumers still depend in Jira; R17). `PreventionPassport.gate` (optional) now says what the validator would decide right now:
`{ "status": "CLOSED", "reason": "the option chosen in plan plan-… assumes work that Jira does not show as done yet (consumers still depend on it). Update the Jira links once consumers have migrated, then re-run the plan" }` — status OPEN | CLOSED | NOT_GATED (issue not labelled anticipate-change).
Suggested UI: a "Jira transition" row in Decision overview: OPEN (green), CLOSED (amber, show reason), NOT_GATED (neutral).

## EXPERIENCE → CORE (3 Nov 2026): outage policy and Passport gate done (display only). Action: see R-37 in EXPERIENCE_TO_CORE_REQUESTS.md
- **Settings → "Workflow validator during an outage"**: shown only when `operations` contains `validator:outage-policy`. Everyone sees "During an outage: Allow / Block" and when it was changed ("by an administrator"; the account ID is not shown). With `canEdit: true`, an Allow / Block switch opens a confirmation that explains the trade-off; nothing is sent on Cancel. On a refused or failed save, the screen says nothing was changed and re-reads the policy. If `getValidatorPolicy` fails, a retry notice is shown. No switch when `canEdit` is false.
- **Passport → Decision overview**: a "Jira transition, checked when this record was loaded" line under the facts: OPEN (green, "the validator allows it"), CLOSED (amber, with `reason`), NOT_GATED (neutral, with `reason`). Kept on one block when printed.
- Tests: `static/hello-world/tests/validator-policy.spec.ts` (7 MOCK_TRANSPORT cases, axe on the admin path). Not checked on the hosted site yet: please open Settings as an admin and as a non-admin, and a Passport for MOBL "Migrate first" (CLOSED expected).

## EXPERIENCE hosted check (3 Nov 2026, dev): Settings as non-admin, PASS
- Site: one-atlas-euza, development installation 2ae8efdf…, after PR #37 (main 0e37a1e). Checked by Orphee with her invited (non-admin) account.
- The "Workflow validator during an outage" panel shows "During an outage: Allow · Changed 03 Nov 2026, 12:03 CET by an administrator", the effect sentence, and "Only a Jira site administrator can change this setting." No Allow/Block switch. Matches the expected `canEdit: false` behaviour.
- Capture (LIVE_FORGE): `evidence/experience/v4-ux/settings-validator-policy-non-admin-LIVE_FORGE-dev.png`.
- Not testable from the UI: a non-admin cannot try a change, because the switch is hidden. The backend `PERMISSION_DENIED` on `setValidatorPolicy` is covered only by the MOCK_TRANSPORT test; a hosted check would have to call the resolver directly as a non-admin (CORE side, optional).

## EXPERIENCE → CORE (3 Nov 2026, jury pass V3): display only
- Scenario Lab and Decision Firewall label option C ("Migrate first" / "Move consumers first") as a simulation assumption, and say that a result is not permission to move the Jira issue. Pass now ends with "it does not authorize the Jira transition".
- Passport starts with an "In short" box: option and verdict, verified actions, transition status (from `gate`), open questions. When `gate` is CLOSED, Limitations adds "The recorded outcome does not authorize the Jira transition."
- New requests in `EXPERIENCE_TO_CORE_REQUESTS.md` (R-38): refresh `TECHNICAL_SECTION.md`; Teamwork Graph provenance fields; enterprise workspace contract. R-37 no longer asks for a merge, only production deploy and the remaining hosted checks (`docs/jury/HOSTED_ACCEPTANCE_PR37.md`).

## Reply to R-38 (3 Nov 2026, CORE)
1. `docs/submission/TECHNICAL_SECTION.md` updated from STATUS.md: five MCP tools, Rovo agent, 80 backend tests, validator with outage policy (incl. R18 unreadable issue), R17 and `gate`, upgrade scenarios.
2. Teamwork Graph provenance: proposed additive contract (no field removed, all optional, so the current UI keeps working). Nothing is sent until the adapter is wired and a hosted query succeeds.
   - Per edge: `source: 'JIRA' | 'TEAMWORK_GRAPH'`; `evidenceKind: 'VERIFIED_LINK' | 'DOCUMENTARY'` (TWG relations are DOCUMENTARY unless backed by a Jira link); `feedsSimulation: boolean` (false for DOCUMENTARY: shown as context, never changes a verdict).
   - Per source in `GraphSnapshot.coverage.sources[]`: `{ source, state: 'LIVE' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_CONFIGURED', needsAdmin?: boolean, detail?: string }`.
   - Settings capability `teamworkGraph` keeps its current values.
3. Enterprise workspace: contract follows the backend prototype on a separate branch (approver eligibility with reason, pending step, approval expiry, Passport visibility). Not before it is enforced server side and tested adversarially.
4. R-37 items: R18 is deployed (dev 4.38.0+, prod 2.26.0; unit tested, hosted 403 check planned on AVT). PR #39 merged and deployed on dev 4.39.0: Passport "In short" on MOBL-58 verified. Print dialog opened once.

## Teamwork Graph hosted attempt (3 Nov 2026, CORE): BLOCKED
The graph scope is restricted for app 39a28f48: Atlassian must allowlist the app (support request with the app id). Until then, the backend keeps reporting `teamworkGraph: NOT_CONFIGURED` and nothing TWG-related should be shown as live. Dev is back on the CORE build (v6.0.0).
