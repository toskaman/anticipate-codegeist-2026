# TITAN-EXPERIENCE — gap audit (first pass)

Reviewed: `main` **8adfdcb** (8 Nov 2026). Author: orpheane (EXPERIENCE). Status: **first pass, partial** — not a final audit.

## Evidence used
- Hosted use of ANTICIPATE **8.1.0** on the dev site (`one-atlas-euza`, project AVT) on 7 Nov, recorded at 1920×1080 for the Codegeist film (raw captures under the owner's `evidence-release-8.1.0/`, outside Git). This is real hosted observation, but by an automated driver, not a human participant.
- Code reading of `static/hello-world/src` (113 files) and the 38 Playwright specs.
- No human usability participants. No native screen reader (NVDA) run: **NOT_VERIFIED**.

## Prioritised gaps

| # | Gap | Evidence | Severity | Status |
|---|---|---|---|---|
| 1 | The signature answer of a portfolio simulation (each change alone vs together, records affected only in combination) is spread over three sections; the first screen after "Simulate" shows a verdict badge and an evidence-coverage notice, not the comparison | hosted 8.1.0 capture `wow1-collision`; `PortfolioPanel.tsx` order: Combined → coverage → shared → conflicts → … → per-change explanations | High (Design, Innovation legibility) | **Fixed on this branch**: "Collision at a glance" region first |
| 2 | Mouse wheel over the Evidence Graph zooms the map instead of scrolling the page (React Flow defaults) | hosted recording sc02 (map zoomed out while scrolling); `EvidenceGraph.tsx` had no `zoomOnScroll`/`preventScrolling` props | Medium (usability, keyboard/mouse reading flow) | **Fixed on this branch** + regression test |
| 3 | The app never shows its own build version/commit; a judge or owner cannot confirm which build is running without Forge CLI | hosted 8.1.0 Settings page shows `CORE 0.2.0` contract label only | Medium (judge reproducibility) | Open — needs a CORE decision on what version identity to expose (build-time define vs backend capability) |
| 4 | The "Execute approved actions" confirmation names the action ("Execute in Jira") but the success state requires scrolling to "4 · Verify results" | hosted capture sc08 | Low | Open (candidate: move focus to the verification result after execution) |
| 5 | Cross-browser coverage on this machine: Firefox/WebKit Playwright builds are not installed | local run 8 Nov | Process | Open — needs `npx playwright install firefox webkit` (owner approval for download) |
| 6 | Native screen reader, 200/400 % zoom and forced-colors were not exercised by a human | — | Medium | NOT_VERIFIED |

## Verification of the fixes (local, MOCK_TRANSPORT — not hosted evidence)
- `typecheck`, `lint`, Prettier on changed files, `vitest` **203/203**, `vite build`: pass.
- Playwright **chromium 37/37**: graph-scroll (new), portfolio-panel (incl. axe), accessibility, collision-explorer, large-graph, core-reflow, journey, decision-clarity, screens.
- Firefox and WebKit: **not run** (browsers missing locally; CI runs them on the PR).
