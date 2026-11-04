# Product clarity regression evidence — LOCAL / MOCK_TRANSPORT

Run: 4 November 2026, Windows, baseline `main` **39ccc3f** plus the delivering PR. Fixtures in `tests/decision-clarity.spec.ts` supply the Jira-shaped responses. **No Forge session, hosted integration or real Jira action is proven here.**

| Check | Result |
| --- | --- |
| Frontend TypeScript / ESLint | Passed |
| Frontend unit tests | **134/134**, including pairwise snapshot isolation, deduplication, missing input, bounded map paths and passive concept states |
| Full Chromium Playwright | **113/113**, one full run, 2 workers, 2.6 minutes |
| New clarity suite, Firefox | **6/6**, 19.9 seconds |
| New clarity suite, WebKit | **6/6**, 17.6 seconds |
| New clarity suite, Chromium after capture-only adjustment | **6/6**, 16.6 seconds |
| Native selects, keyboard focus and reduced motion | Passed scripted cases for OS and saved preference |
| Pair inspector reflow | 320, 390, 768, 1024, 1440, 1920, 3440 px; both themes; no horizontal page overflow |
| axe | No violations in scoped new pair/path checks; full existing accessibility suite passed. Not a certification |
| Read-only pair/path interaction | No additional resolver request; selected decision unchanged |
| Production build | Passed; no passive enterprise concept module/string found in built assets |
| Formatting | Frontend Prettier with `--end-of-line auto` on Windows; unchanged CRLF files retained. Linux CI uses standard format check |

## Captures

These four **Chromium MOCK_TRANSPORT** element captures show the pair inspector, not a hosted site. File width denotes browser viewport, not cropped panel width. The test-only sticky disclaimer is made static during element capture so it does not cover a label; source label remains explicit here and in every filename. Test data includes a fixed synthetic snapshot timestamp. Reviewed for readable wrapping, status text/icon, assumption and keyboard focus.

- [Dark, 320 px](decision-difference-dark-320-MOCK_TRANSPORT.png)
- [Light, 320 px](decision-difference-light-320-MOCK_TRANSPORT.png)
- [Dark, 1440 px](decision-difference-dark-1440-MOCK_TRANSPORT.png)
- [Light, 1440 px](decision-difference-light-1440-MOCK_TRANSPORT.png)

## Build observation

Vite reported ForgeApp **139.42 kB / 38.48 kB gzip** and lazy EvidenceGraph **196.37 / 63.18 kB gzip**. Before this work the observed raw chunks were 134.61 kB and 194.04 kB respectively. These are bundle outputs, not user latency measurements. No runtime dependency added; graph remains lazy-loaded. Graph focus caps 40 loaded records and 120 supplied relationships, with missing/omitted context disclosed. Pair groups render six named records with a full-result pointer.

## Required acceptance still pending

- [ ] Muse reviews/merges the delivery after CI; this local report does not assert either happened.
- [ ] Muse deploys through the existing CORE process and records site/build/UTC/account role.
- [ ] On real Jira: verify first-screen read/write boundary and demo focus, compare named consequences without changing the selected decision or issuing a write; verify Unknown and migration assumption remain visible.
- [ ] On real Jira: focus a supplied indirect impact path, inspect source references, restore overview/search; missing context must remain explicit.
- [ ] Complete #126's clean-project dated-sample/slip hosted check; old sample dates must stay unchanged.
- [ ] Capture the evidence-change notice/refusal before using the planned video scene. Follow `docs/submission/DRIFT_CAPTURE_PLAN.md`; do not substitute these mock captures.
- [ ] Native screen reader, real browser zoom and human usability study remain unperformed. Firefox/WebKit results above cover only the six new cases, not the entire regression suite.

Portfolio/shared workspace/radar remain passive design concepts excluded from production pending #130/#131/#132 and CORE #134/#135 runtime/hosted gates. No enterprise capability, customer result, commercial price or ROI is claimed.

Final copy review clarified that inspecting a pair is independent from changing the decision card used by the full detail section. Its three component tests and production build passed again; the full-suite results above predate only this explanatory text adjustment.
