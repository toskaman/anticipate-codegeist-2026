# ORP-33 radar attention — LOCAL / MOCK_TRANSPORT

4 November 2026 · baseline `main` **c5040ae** plus the delivering PR. Responses and event times are authored fixtures. No Forge trigger, live Jira change, event-delivery timing or hosted integration is established by these tests.

| Check | Completed result |
| --- | --- |
| Frontend unit suite | **140/140**; new real-component/ForgeClient case covers loading and delayed responses after a plan change |
| TypeScript / ESLint / build | Passed; focused unit/build rerun after keyboard focus-return adjustment |
| Prettier | Passed with Windows `--end-of-line auto`; Linux CI runs the standard check |
| Full Chromium Playwright | **131/131**, one complete run, two workers, 3.3 minutes |
| Eight-case radar suite | **8/8 each Chromium (31.1 s), Firefox (36.0 s), WebKit (36.0 s)**, including final re-check/retry focus restoration |
| Accessibility / reflow | Light/dark scoped axe, keyboard re-check, 320/390/768/1024/1440/1920/3440 px without page overflow |
| Guard integration | Real workflow freshness path; changed evidence disables approval/execution and sends neither request |
| Failure semantics | Explicit retry, no invented monitoring state, failed freshness check keeps the backend review hint |
| Passport separation | Current attention outside recorded report, hidden for print; no Passport JSON mutation |

The full run used a clean set of generated local visual outputs to avoid the known Windows overwrite error. All historical Git-backed screenshots/PDFs were restored afterwards; only this task's four labelled captures are delivered. No assertions were relaxed to bypass an application failure.

## Captures

Final WebKit element captures at a 390 px viewport, **MOCK_TRANSPORT**. Fixed synthetic dates and notes remain visible. The sticky test-only disclaimer is made static during element capture; evidence class stays explicit in filenames and this record. These are development artifacts, excluded from hosted submission evidence.

- [Dark — needs review](radar-dark-390-WebKit-MOCK_TRANSPORT.png)
- [Light — needs review](radar-light-390-WebKit-MOCK_TRANSPORT.png)
- [Dark — after explicit re-check/reload](radar-dark-rechecked-390-WebKit-MOCK_TRANSPORT.png)
- [Light — after explicit re-check/reload](radar-light-rechecked-390-WebKit-MOCK_TRANSPORT.png)

Reviewed for readable events, observation time, uncertainty, non-green monitoring state and keyboard affordances. Native screen readers, human usability and hosted latency remain unverified.

## Production and acceptance boundary

The **6.38 kB / 2.61 kB gzip** radar module is lazy-loaded only behind the advertised operation. No runtime dependency or backend/contract/manifest change. Stored event hints are not a browser subscription or an authorization verdict. The note remains verbatim, and missing events never become a green success state.

CI, Muse review/merge and the [hosted checklist](../../../docs/design/RADAR_UI_ACCEPTANCE.md) remain separate gates: actual payload/trigger delivery, monitoring/coverage, same-plan re-check/reload, changed-evidence refusal, ownership denial, responsive/keyboard and print/export separation. Record site/build/UTC/account role and actual outcome; do not relabel these captures LIVE_FORGE.

The full 131-case run preceded the final focus-only adjustment. Its eight relevant cases were rerun on all three browsers afterwards, without relaxing assertions; latest-head CI remains a separate gate.
