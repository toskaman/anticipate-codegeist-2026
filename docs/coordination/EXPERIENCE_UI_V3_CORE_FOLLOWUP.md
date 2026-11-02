# EXPERIENCE → CORE: UI v3 follow-up, 2 November 2026

## Candidate and source scope

Current delivery is the non-draft [PR #14](https://github.com/toskaman/anticipate-codegeist-2026/pull/14), `feat/product-experience` → `main`. Use its final head SHA and CI result. Main was synchronized through `6641e43`, including CORE `7a6c80b`. No newer remote CORE reference was present during this check. No EXPERIENCE-authored backend/shared-contract/manifest changes, app registration, deployment or PR merge.

## Requests verified and addressed

| Item | Frontend behavior / evidence |
| --- | --- |
| Refusal because dependencies changed | `EvidenceChangeNotice` in Plan, Firewall and Passport displays the backend reason and added/removed/newly unknown evidence. The refused plan stays blocked after dismiss, status refresh and reload. `core-integration.spec.ts` asserts those behaviors and raw Passport export. Rebuild snapshot starts a new review. |
| Judge sample preparation | Mission Control contains **Prepare a demo project**; preview first, then a separate **Create sample data** confirmation for real labelled Jira tickets. It uses an existing accessible Jira project, never creates a project. No writes on opening, preview, cancel or navigation. |
| Slow sample creation | Production Forge client now observes `createSampleProject` for **60 seconds**, rather than the previous 12. Other operations retain 12 seconds. Injected test timeouts remain explicit. Timeout guidance says creation may still be running and requires re-preview before further creation. No automatic retry. New fake-clock tests cover a successful 20-second response and a 60-second timeout; browser coverage checks recovery by preview without a second creation call. |
| README and screenshots | Root README replaces the Forge Hello World template with actual functionality, judge instructions, Windows setup and genuine Playwright screenshots. All screenshots are explicitly LOCAL/MOCK_TRANSPORT; they do not claim hosted execution. The frontend guide's obsolete pending-backend text was removed. |
| New CORE work | Settings reflects five declared MCP tools, Rovo agent and optional workflow validator; declaration/report/verification remain distinct. Additive UPGRADE_NODE contract is accepted. The UI still presents retirement scenarios; upgrade scenarios are currently backend/Rovo/MCP functionality. No dedicated UI upgrade picker is claimed. |

## Remaining CORE work

1. Review PR #14 and merge it through the normal review process when accepted; EXPERIENCE will not merge it.
2. Build/deploy the accepted exact SHA to **development** using the existing authorized owner identity. Do not reuse an old frontend build. Record source SHA, version and environment in your response.
3. In an authenticated Forge session, verify: reason/diffs on a genuine changed-evidence refusal with zero execution writes; judge preview → confirmed sample creation → re-preview → Analyze; the 15–20-second creation no longer falsely times out; Plan → Firewall → Passport state remains consistent; host iframe sizing and themes work.
4. On any deliberately induced lost response, re-preview before another sample creation. Client observation timeout does not cancel or roll back server execution. Report recovered existing tickets and absence of duplicate writes.
5. Only after hosted acceptance, handle production promotion under the owner's existing authorization and report the exact source/environment. Local tests and CORE's previous PR #9 hosted report do not certify this UI v3 build.

No new backend resolver is required for these fixes. Native screen-reader/zoom and long soak remain unrun. Dependency/license findings are unchanged. CORE's old `status-core.json` is historical; current contract and deployment evidence should be taken from the latest source and dated reports, not its old pending-auth fields.

## Verification

Frontend typecheck, ESLint, formatting, **49/49 unit tests** and production build passed. Focused connected-screen/safety/sample browser run: **22/22 passed, 114.2 s**, zero skipped/unexpected/flaky. The previous full v3 baseline passed 72/72 Chromium on `653d164`; this follow-up runs the connected-screen/safety/sample suites rather than claiming a new full-suite or hosted result. Root backend code is unchanged from the already-tested 43 CORE / 3 contract / 10 simulation baseline.
