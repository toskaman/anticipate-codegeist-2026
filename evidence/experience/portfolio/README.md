# ORP-32 portfolio UI — LOCAL / MOCK_TRANSPORT

4 November 2026 · baseline `main` **4d937b6** plus the delivering PR. This uses authored test responses with the real frontend/ForgeClient, not a Forge session or Jira actions. Hosted proof remains pending with Muse under [PORTFOLIO_UI_ACCEPTANCE](../../../docs/design/PORTFOLIO_UI_ACCEPTANCE.md).

| Check | Recorded result |
| --- | --- |
| Frontend unit tests | **139/139**; includes loaded-node/migration bounds and the real component/client's pending-response isolation |
| TypeScript / ESLint / production build | Passed after refreshing the local contracts package from merged CORE |
| Formatting | Prettier passed with Windows `--end-of-line auto`; CI uses its standard Linux check |
| Portfolio Chromium suite | **10/10**, including non-default single-change selection preserved |
| Portfolio Firefox suite | **10/10**, 29.5 s |
| Portfolio WebKit suite | **10/10**, 28.7 s |
| Full Chromium regression | **123/123**, one completed run, 2 workers, 2.8 minutes |
| Responsive / accessibility | 320/390/768/1024/1440/1920/3440 px; light/dark; no page overflow; scoped axe clear; keyboard add/remove focus and submit |
| Mutation isolation | Unexpected operations fail the harness; no approve/execute/create operation during portfolio work |

Initial broader validation caught a test-only comparison fixture without its required replacement selection; the real client refused it. Corrected the test setup before the successful ten-case Chromium run. Broader runs encountered Windows `UNKNOWN` while overwriting existing generated captures, not application assertions. Git-backed local visual outputs were cleared for regeneration, the final full run passed 123/123, then all historical tracked evidence was restored from Git. Interrupted runs are not counted as passes. Only the two new labelled portfolio captures are delivered.

## Reviewed captures

Final **WebKit** element captures at a 390 px viewport, authored MOCK_TRANSPORT. The fixed synthetic snapshot date and outcomes are test data. The sticky test-only disclaimer becomes static for element capture so it cannot obscure the panel; filenames and this record retain the evidence class. Reviewed light/dark wrapping, status text/icon, migration assumptions, ordering and hash. No native screen-reader/human comprehension/hosted performance claim.

- [Dark](portfolio-dark-390-WebKit-MOCK_TRANSPORT.png)
- [Light](portfolio-light-390-WebKit-MOCK_TRANSPORT.png)

## Build observation

PortfolioPanel is a separate **12.69 kB / 4.36 kB gzip** chunk, reached only behind the real capability/operation gate. No runtime dependency added. Existing graph remains lazy-loaded. Bundle bytes are not user task time or hosted latency; contracts also gained upstream schemas in this baseline.

## Acceptance still pending

CI, Muse review/merge and hosted acceptance are separate gates. Muse must record site/build/UTC/role, repeatability on one reused snapshot, real shared consequences/conflicts/order/gaps, permission-safe refusal and unchanged Jira state. The UI's loaded-node selectors are not backend authorization evidence. Shared activation/two-account testing and radar event-to-UI proof remain outside ORP-32. Final video and Devpost publication remain deferred.
