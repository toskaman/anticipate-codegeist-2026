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
| Full Chromium Playwright suite | 72/72 passed, --workers=1 (227.3 s). Earlier 6-worker run had one 250 ms harness response timing failure; all 13 visual cases also passed separately with one worker. |
| Firefox critical suites | 32 cases covered: 31 passed initially; the one cold-start candidate read timed out with the 250 ms harness transport, then passed with `--workers=1` (12.5 s targeted run). No assertion or transport timeout was weakened. |
| WebKit critical suites | 32/32 passed (2.4 min) |
| Final mobile graph reflow adjustment | 3/3 Firefox (12.3 s) and 3/3 WebKit reflow cases passed after the final zoom/padding adjustment. |
| axe WCAG-tagged checks | Real axe runs in critical suites cover seven screens, light/dark, desktop/tablet/mobile; refusal/sample states also checked. No blanket accessibility certification. |
| Root `npm ci`, TypeScript, tests | PASS; 31 CORE tests |
| Contracts / simulation | 3/3 and 8/8 passed |
| Hosted Forge (LIVE_FORGE) | NOT RUN. CORE owns deployment and authenticated acceptance. |
| Native browser zoom, screen reader, long soak | NOT RUN. CSS 200% reflow is a stress test, not native zoom/AT certification. |

Firefox/WebKit coverage is limited to core-integration, core-pagination, core-reflow and sample-project specs. The full legacy prototype, visual showcase, print and performance suite is covered by Chromium, not claimed as full cross-engine coverage.

## Preserved behavior and conflict resolution

`CoreWorkspace.tsx` is the thin v3 composition root. Evidence refusal state, details, selection/confirmation clearing and sample busy/replacement/snapshot handling were ported into `app/useCoreWorkflow.ts`. The same resolver names, plan hashes, idempotency keys, execution-attempt storage, lost-response recovery and separate confirmations remain. Changed evidence blocks approval/execution even after dismiss, refresh and reload; Passport retains the raw status.

Sample preparation uses the v3 Panel/DecisionDialog styles but still previews before explicitly confirming real Jira creation. It cannot create a Jira project. Opening, previewing, cancelling and navigation never execute Jira writes. The local fixture prototype stays isolated.

Settings' static capability column reflects four read-only MCP tools and the Rovo agent declaration in the current manifest. Backend availability remains separate; declarations do not become verification claims.

## Defects corrected during real verification

- Low-contrast light success badge, overlay/accent labels and selected evidence/navigation metadata: strengthened semantic colors.
- Text fading through unreadable intermediate contrasts: page/card entry motion keeps translation/scale but no text opacity fade.
- Search icon overlapped the input text: corrected input padding specificity.
- Mobile map auto-fit made labels microscopic: default mobile viewport uses readable zoom, with explicit pan/zoom/list guidance; actual data windows and selection remain unchanged.
- Drift/sample-specific tests ported to v3 labels and dialogs, with call-count, disabled-state, recovery and exported raw-status assertions preserved.

## Limits and release ownership

No new dependency, backend, shared-contract, manifest, Forge identity, permission or deployment change. This work does not establish hosted Forge compatibility or a live Jira outcome. Dependency findings remain frontend 14 moderate/2 high, root 15 moderate/2 high/2 critical; missing license texts remain open. Local captures are MOCK_TRANSPORT. CI frontend job installs/builds; local unit/browser/axe results are separate evidence. No PR merge or Forge deployment is performed by EXPERIENCE.
