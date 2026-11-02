# CORE overnight follow-up — 2026-11-02

Merged origin/feat/core-engine through ea829ef as ca2541d. Three new commits:

- fc8d61e: CORE reports the d9d6109 integrated build deployed to development as v4.3.0 at 02:10 UTC. This is a CORE-reported deployment, not EXPERIENCE-hosted verification.
- 0ef491b: four mocked adapter tests for opaque JQL paging, route encoding, 429/403/5xx mapping, ADF text safety and KVS FAIL_IF_EXISTS behavior.
- ea829ef: technical Devpost input and a deferred workflow-validator research note.

There are no changes to shared contract 0.2.0, runtime backend code, manifest or dependency versions in these commits. EXPERIENCE made no authored changes to CORE-owned files. The workflow validator remains unimplemented; no Jira workflow or Forge deployment was changed here.

## Frontend follow-up

CoreOperationError now distinguishes failed reads from mutation outcomes needing status/audit review. It retains the server code/request correlation, explains rate limits and permission failures, and never triggers an automatic retry. Dismissing an alert changes presentation only; the execution-attempt marker and recovery gates remain in force. Verified individual records are not erased or promoted by an audit/read failure.

Cursor paging now has dedicated browser coverage: project and candidate cursors are sent unchanged, duplicate entries are merged by ID, repeated cursors are rejected without a request loop, empty/disabled listings insert no demonstration project, and switching projects clears candidates, root input and the previous graph. A manual issue key from another selected project is rejected before requesting a mislabeled snapshot. Cross-project dependencies within a legitimate snapshot remain allowed.

## Verification

42 frontend unit tests; 48 Playwright tests including 42 connected and 42 prototype screen/theme/size cases; 16 CORE tests; 3 contract tests; 8 simulation tests passed. Root/frontend TypeScript, frontend ESLint, formatting and production build passed. CORE tests use fake transport/KVS and do not prove hosted atomicity or user permissions. New screenshots show rate-limit/permission errors under MOCK TRANSPORT. Existing graph benchmarks were rerun as prototype regressions only; no hosted performance target is claimed.

Evidence and the current build hashes: evidence/experience/core-night-followup/. Prior milestone evidence remains tied to its historical commits.

## Next hosted gate

The owner explicitly deferred deployment of this follow-up. CORE's report of an earlier d9d6109 development deployment is recorded without inferring authentication, Jira outcomes or deployment of newer changes. User-context validation remains pending an authorized Atlassian browser session. EXPERIENCE did not use a Forge token, deploy, change a Jira workflow or execute a real Jira action.

Existing dependency advisories and license-text review remain open as recorded in CORE_CLIENT_INTEGRATION.md. No security/release approval is implied. Presentation/submission copy is a local draft; nothing was submitted or published to Devpost.
