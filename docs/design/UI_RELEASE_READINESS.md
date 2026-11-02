# UI v3 release readiness

Branch: `feat/product-experience`. Imported UI bundle `499522d8a735c56070f128de9570c57fb3d62003` (based on e4f3235), integrated over verified safety/sample work `7fefdbc`. Final SHA, remote match and CI links are recorded in the pull request.

## Actual integration-environment verification — 2026-11-02

The bundle author's esbuild/React 19 run is historical only. Results here use the repository's real npm installation, Vite 8, React 18 and published React Flow dependencies. No axe stub is used.

| Check | Actual result |
| --- | --- |
| Frontend `npm ci` | PASS |
| Frontend TypeScript, ESLint, formatting | PASS |
| Frontend `npm test` | 47/47 passed, real vitest; includes 3 graph layout tests |
| Vite production build | PASS; graph remains lazy-loaded |
| Full Chromium Playwright suite | 72/72 passed, --workers=1 (234.6 s, final synchronized main and mobile-table correction). Earlier 6-worker run had one 250 ms harness response timing failure; all 13 visual cases also passed separately with one worker. |
| Firefox critical suites | 32 cases covered: 31 passed initially; the one cold-start candidate read timed out with the 250 ms harness transport, then passed with `--workers=1` (12.5 s targeted run). No assertion or transport timeout was weakened. |
| WebKit critical suites | 32/32 passed (2.4 min) |
| Final mobile graph reflow adjustment | 3/3 Firefox (12.3 s) and 3/3 WebKit reflow cases passed after the final zoom/padding adjustment. |
| axe WCAG-tagged checks | Real axe runs in critical suites cover seven screens, light/dark, desktop/tablet/mobile; refusal/sample states also checked. No blanket accessibility certification. |
| Root `npm ci`, TypeScript, tests | PASS; 31 tests on the initial baseline and 43/43 after synchronizing main through fda93de |
| Contracts / simulation | 3/3 and 8/8 passed |
| Hosted Forge (LIVE_FORGE) | NOT RUN. CORE owns deployment and authenticated acceptance. |
| Native browser zoom, screen reader, long soak | NOT RUN. CSS 200% reflow is a stress test, not native zoom/AT certification. |

Firefox/WebKit coverage is limited to core-integration, core-pagination, core-reflow and sample-project specs. The full legacy prototype, visual showcase, print and performance suite is covered by Chromium, not claimed as full cross-engine coverage.

## Preserved behavior and conflict resolution

`CoreWorkspace.tsx` is the thin v3 composition root. Evidence refusal state, details, selection/confirmation clearing and sample busy/replacement/snapshot handling were ported into `app/useCoreWorkflow.ts`. The same resolver names, plan hashes, idempotency keys, execution-attempt storage, lost-response recovery and separate confirmations remain. Changed evidence blocks approval/execution even after dismiss, refresh and reload; Passport retains the raw status.

Sample preparation uses the v3 Panel/DecisionDialog styles but still previews before explicitly confirming real Jira creation. It cannot create a Jira project. Opening, previewing, cancelling and navigation never execute Jira writes. The local fixture prototype stays isolated.

Settings' static capability column reflects five read-only MCP tools and the Rovo agent declaration in the current manifest. Backend availability remains separate; declarations do not become verification claims.

## Defects corrected during real verification

- Low-contrast light success badge, overlay/accent labels and selected evidence/navigation metadata: strengthened semantic colors.
- Text fading through unreadable intermediate contrasts: page/card entry motion keeps translation/scale but no text opacity fade.
- Search icon overlapped the input text: corrected input padding specificity.
- Mobile map auto-fit made labels microscopic: default mobile viewport uses readable zoom, with explicit pan/zoom/list guidance; actual data windows and selection remain unchanged.
- Drift/sample-specific tests ported to v3 labels and dialogs, with call-count, disabled-state, recovery and exported raw-status assertions preserved.

## Limits and release ownership

No new dependency, backend, shared-contract, manifest, Forge identity, permission or deployment change. This work does not establish hosted Forge compatibility or a live Jira outcome. Dependency findings remain frontend 14 moderate/2 high, root 15 moderate/2 high/2 critical; missing license texts remain open. Local captures are MOCK_TRANSPORT. CI frontend job installs/builds; local unit/browser/axe results are separate evidence. No PR merge or Forge deployment is performed by EXPERIENCE.

## Final main compatibility follow-up

The UI merge was committed, the imported handoff folder was removed with targeted file cleanup, and the temporary import branch was deleted. Main had advanced through CORE 02d6104 while UI verification ran, so its existing commits were merged without EXPERIENCE-authored backend changes. Clean installs, root/frontend TypeScript, lint, 47 frontend unit tests, 43 CORE tests, 3 contract and 8 simulation tests, and build passed again. The six screen/theme/viewport accessibility matrix cases plus the eight drift/sample cases passed again (14/14, 1.2 min), and all 13 visual cases were regenerated and passed again (1.0 min).

The Settings declarations now reflect the optional Jira workflow validator in that manifest as well as the Rovo agent and five MCP tools; backend-reported availability and verification remain separate. Teamwork Graph is reported by the backend rather than incorrectly described as absent. These policy explanations are distinct from administrator-configured transition enforcement.

Native mobile Passport review found overly narrow table cells splitting status words into letters. Tables now retain a readable minimum width within their already-labelled, keyboard-focusable horizontal scroll regions, with a print-specific reset. This is a deliberate two-dimensional scroll region, not page overflow. Final mobile matrix cases passed 2/2 and visual journeys passed 2/2 (dark rerun after a Windows screenshot file-open error). Adding a positioned scroll container also prevents positioned table content from propagating overflow to the page. Assertions were not weakened. After the latest main sync and all corrections, the complete Chromium suite passed again: 72/72, 234.6 s, zero unexpected/flaky/skipped cases.

Measured final Vite output: main Forge application JS 165.93 kB (42.86 kB gzip), lazy graph JS 193.81 kB (62.37 kB gzip); main CSS 61.53 kB (11.39 kB gzip), graph CSS 15.41 kB (2.56 kB gzip). These are build sizes, not loading-time or interaction-speed claims. Asset hashes are in the verification folder.

Latest main compatibility: merged main `6641e43` (CORE `7a6c80b`); fresh installs, root/frontend TypeScript, lint, 47 frontend tests, 43 CORE tests, 3 contract tests and 10 simulation tests passed. The additive UPGRADE_NODE contract is accepted; the frontend still presents the existing retirement journey. Settings reflects the fifth read-only MCP tool. CORE reported earlier sample creation successful on hosted development; that report applies to PR #9, not this UI v3. The sample error guidance now explicitly says a timed-out creation may still be running and directs re-preview rather than automatic retries.

## CORE sample-timeout and README follow-up

Against the same CORE 7a6c80b/main 6641e43 baseline, frontend TypeScript, lint, formatting, build and **49/49 unit tests** passed. Connected-screen/evidence-safety and sample preparation browser suites passed **22/22**, 114.2 s, one worker, zero skipped/unexpected/flaky cases. This focused follow-up is separate from the earlier full 72/72 Chromium baseline at 653d164. Two new fake-clock tests exercise a 20-second creation response and the 60-second bounded wait; browser recovery verifies re-preview without another creation call. Default read observation remains 12 seconds. Root README and frontend guide now describe the actual UI with genuine, explicitly MOCK_TRANSPORT captures. [CORE follow-up](../coordination/EXPERIENCE_UI_V3_CORE_FOLLOWUP.md) lists hosted acceptance steps.

Updated build: main app JS 166.01 kB (42.87 kB gzip); CSS/graph sizes unchanged. Current asset hashes replace the earlier build inventory; earlier build sizes above retain their dated scope. No hosted validation or new backend change is claimed.
