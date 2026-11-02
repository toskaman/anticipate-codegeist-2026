# CORE 0.2.0 frontend integration

Status: VERIFIED_LOCAL wiring; hosted user-context/Jira validation is NOT VERIFIED. CORE branch 39b59df was merged without conflict as 9763165. No authored changes to manifest.yml, backend src/, packages/, root package files or Forge identity. No deployment and no real Jira write performed by EXPERIENCE.

## Authoritative boundary

Production imports `@anticipate/contracts` from `file:../../packages/contracts`; `.npmrc` sets install-links=true so a clean frontend npm ci copies the local package and installs its Zod 3 dependency. The installed index.ts SHA-256 matches the checked-in CORE index.ts. Do not replace it with an independently maintained schema. The package manifest still says 0.1.0; runtime compatibility is checked against authoritative CONTRACT_VERSION=0.2.0.

`src/api/ForgeClient.ts` calls the exact OPERATIONS keys through Forge Bridge and validates input plus `{ok,meta,data|error}`. It enforces 0.2.0/LIVE, preserves every CORE error code/requestId/retryable value, rejects invalid graph endpoints/IDs, fixture provenance and decision identity mismatches. No guessed bindings or fallback. `src/api/core-handoff.ts` re-exports CORE schemas/types and derives operation maps from them. Historical provisional schemas and FixtureClient remain development-prototype-only.

Observation times out after 12 seconds or stops on consumer abort. Neither cancels a backend write. Validation work is bounded before recursive Zod parsing: 100,000 values, nesting depth 64, 20,000 array entries, 1,000 fields per object and 4,194,304 code units of string values. This limits validator amplification after Bridge decoding; it is not a transport/process memory cap or a dependency vulnerability fix.

## Connected seven-screen journey

| Screen | CORE operations and behavior |
| --- | --- |
| Mission Control | getCapabilities, listProjects cursor paging, getChangeCandidates cursor paging, explicit project/root issue selection; getGraphSnapshot(source=JIRA) then getEvidenceGraph for that snapshot; empty/permission/error states |
| Evidence Graph | Actual CORE nodes, from/to relation kinds, evidence status, references/access limitation and snapshot TTL; 6/12/20 nodes per window at mobile/tablet/desktop, at most 80 drawn edges; searchable accessible list; impact depth/path from chosen simulation only |
| Scenario Lab | compareScenarios with real SimulationRequest: A REMOVE_NODE, B DEPRECATE_NODE, C only after explicit distinct replacement selection using MIGRATE_DEPENDENTS(USES,DEPENDS_ON) then REMOVE_NODE; no authored live scores |
| Decision Firewall | Exact selected result verdict, violations, uncertainty and supplied paths; generatePreventionPlan(snapshotId,scenarioId) after comparison |
| Prevention Plan | Real action payload/target/reason/evidence/permission/verification; approvePlan(planId,planHash,approvedActionIds,idempotencyKey) only after selection and confirmation; executeApprovedPlan(planId,idempotencyKey) in a separate confirmation |
| Prevention Passport | getPreventionPassport(planId); display/export identical validated object: comparison, scenario-bound plan, backend approvals, per-action executions, openUnknowns and timeline; print styling retained |
| Settings | Live capability states and enabled operations, host theme observer; no credential field or fake connection toggle |

`simulateChange` and getPolicies are also typed/validated client operations. The comparison already runs the deterministic simulator; UI policy details come from SimulationResult, not hard-coded A/B/C rules. C is not fabricated without a known user-selected replacement. A/B can generate their own backend plans.

Changing project/root/snapshot/replacement/comparison/scenario invalidates the dependent reviewed state. Expired snapshots block new approval/execution. Previously recorded approval alone never starts execution. Execution confirmation names ALL backend-approved IDs, including prior selections; the backend operation executes all approved actions, not a fresh frontend subset.

## Recovery and write gates

The visible planId is retained in sessionStorage for recovery after reload. Before invoking execute, a per-plan execution-attempt marker/key is persisted; failure to persist blocks the write. A timeout, malformed reply, empty status list or reload cannot unlock automatic resubmission. The UI provides no retry-write button; existing backend status/approval records are inspected manually. Marker retention is a conservative same-tab guard, not server-side authorization or cross-device idempotency.

Recover plan/status from Mission Control using getPreventionPassport({planId}) and getExecutionStatus({planId}); executionId or an idempotency lookup is not required. If evidence has expired, preserve the recovered audit/status and disable new writes. A current plan hash, matching snapshot/scenario, verified approval audit and advertised write/status/Passport capabilities are required before offering execution. Only VERIFIED records are described as verified; FAILED/SUBMITTED/CLAIMED/SKIPPED are displayed as returned.

CORE remains responsible for authenticated user/installation context, permissions, snapshot ownership/TTL, plan-hash enforcement, atomic approval/execution leases, reconciliation and actual post-write verification. Browser flags and checkboxes are not authorization.

## Entry and fixture isolation

Production always loads ForgeApp/CoreWorkspace. A development server inside a host iframe also loads CORE, so forge tunnel does not accidentally show the authored prototype. Top-level local Vite remains the labeled demo; `?core=1` can preview the real entry without supplying fake data. Outside a supported installation Bridge errors are explicit, not PENDING_BACKEND or fixture success.

`tests/core-harness.html` is a dev-server-only entry, excluded from the Vite production build. Its transport is intercepted in browser tests and prominently says MOCK TRANSPORT. These tests issue no Atlassian calls. The CORE contract fixtures are not imported into production. Authenticated Forge integration is not established by a mocked LIVE envelope.

## Verification evidence

- Clean frontend npm ci --ignore-scripts passed with the local contracts package; TypeScript, ESLint, Prettier check, 42 frontend unit tests and Vite build passed.
- 41 Playwright tests passed with one worker. Includes normal/lost execution responses, persisted uncertain requests after reload, empty execution records, failed writes, stale approvals, scenario invalidation, expired audit recovery, permission errors, JSON export contents, production isolation and the development iframe entry.
- 42 CORE screen/theme/viewport combinations (seven screens, light/dark, 1440/1024/390), axe WCAG-tagged checks and document overflow passed. Native PNGs and six derived contact sheets are under evidence/experience/core-integration. Contact-sheet visual review covered all six; mobile native graph was inspected for fit/readability. Canvas labels remain an overview; the accessible list is the readable alternative. No exhaustive assistive-technology or pixel-level claim.
- Existing prototype screen matrix also passed; old benchmark evidence remains historical rather than being relabeled as hosted/core performance.
- CORE typecheck plus 12 service/Rovo tests, 3 contract tests and 8 simulation tests passed after merge.
- Production bundle inspection excludes authored fixture/test-harness markers. Build file hashes are recorded in evidence/experience/core-integration/build-manifest-LOCAL.json; build outputs are ignored by Git.

## Hosted gate and known limitations

CORE supplies the development URL: https://one-atlas-euza.atlassian.net/apps/full-page/2ae8efdf-84b8-4851-a341-e4fa2499595c/hello-world/ . A read-only unauthenticated browser check redirected to https://id.atlassian.com/login. Native browser control failed during startup with a Windows CryptUnprotectData error. No authenticated user-context, hosted Bridge/CSP/theme/routing or real Jira outcome has been verified here. No colleague credentials or Forge CLI tokens were used or persisted.

A CORE/owner development deployment of this frontend build and an authorized Atlassian browser session are required before claiming completion of hosted integration. AGENTS.md assigns deployment to CORE and says never deploy a Forge application here. Nothing was registered, installed, deployed or merged into main.

Frontend npm audit: 20 advisories (13 moderate, 7 high), including inherited Zod 3 through the CORE package. Root audit observed 19 (15 moderate, 2 high, 2 critical). No forced upgrades or changes to CORE dependencies. Response preflight is a local mitigation only. Owners must review/remediate dependency risks before release. Current notices inventory: 24 direct packages, 162 runtime paths, 11 missing root-license texts, including the internal contracts package; custom Forge terms need owner review. No security/legal clearance is claimed.

Still to verify on the deployed app: real project/change paging, host auth/permission denial, snapshot expiry, genuine A/B/C results and provenance, scenario-linked plans, selected approval audit, one explicitly authorized Jira action, status after a lost response, and the matching Passport/outcome. Optional Confluence/Rovo/AI states remain whatever capabilities reports. No unadvertised feature is portrayed as available.
