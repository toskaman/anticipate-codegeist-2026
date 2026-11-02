# Performance, visual quality and CORE readiness

Verified LOCAL on 2026-11-02. No hosted Forge validation, deployment or Jira execution. Production remains a capability/access view with no demo fallback.

## Measured Evidence Graph

Deterministic datasets contain exactly 100, 500 and 1,000 total nodes (root included), with 101, 501 and 1,001 directed relationships. Topology: sparse star with a two-edge cycle and repeating authored evidence metadata. Not representative of arbitrary dense or deeply connected production graphs.

Headless Chromium 156.0.8078.4 on Windows; local Vite development build, 1440×1000, one Playwright worker. For each size: five warm switches from the small dataset, five searches and selections, one next-page operation. Rendering ends after the expected 21 DOM graph nodes and two animation frames. Timings include fixture construction, validation, Playwright synchronization and action overhead, not just browser paint or CPU time. Full test source and raw data are committed.

| Total nodes | Render median ms | Render max ms | Search median ms | Select median ms | Page ms | JS heap after GC MiB (delta) |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 66.97 | 86.77 | 16.10 | 33.81 | 57.98 | 20.85 (+2.45) |
| 500 | 84.99 | 99.18 | 16.03 | 34.44 | 82.85 | 21.02 (+2.62) |
| 1000 | 68.12 | 87.94 | 16.04 | 36.39 | 68.76 | 21.20 (+2.81) |

Memory uses CDP Runtime.getHeapUsage and Memory.getDOMCounters before/after forced GC; raw pre-GC samples are retained. This measures JS heap, not total browser/process/GPU memory or peak usage. Positive heap delta includes larger active data and UI. No page errors or browser crashes occurred in these workloads. Five samples cannot certify tail latency, leak freedom, a long soak or a performance SLA. No target or statistically significant speedup is claimed. Exploratory baseline files used dependency counts excluding root and are marked accordingly; do not compare them as matched trials.

Model benchmark: 100 iterations after ten warmups per size, filter/page plus iterative BFS using a reused index; excludes fixture creation, schema validation, index construction and browser work. Raw median/p95/max are in model-performance-LOCAL.json. Browser route reliability also ran 30 warm round trips; latest observations are in ../v2-reliability/browser-observations-LOCAL.json under evidence/experience.

Optimization: snapshot-scoped adjacency, incoming-edge and lowercase-label indexes replace repeated full-edge scans. Memoized flow nodes/edges reuse the current bounded window. The list renders 20 dependencies per page; the graph draws at most 41 nodes (including path/context) and 80 edges. Search discovers off-page nodes; selection can reveal a context node and clear incompatible filters. Cycles terminate. Omitted context is disclosed. This progressive disclosure prevents an unreadable wall while retaining a keyboard-accessible list. Full loaded payload remains bounded by 10,000 dependencies / 30,000 relationships; server paging/grouping is future contract work.

## Seven-screen visual and UX audit

42 genuine full-page Chromium PNGs: seven screens × dark/light × 1440/1024/390 widths, viewport height 1000. Originals: evidence/experience/performance-visual-core/screens/{screen}-{theme}-{width}.png. Contact JPGs are reduced review sheets derived from originals, not generated mockups. Manual overview inspection covered all six sheets; native mobile capture inspected for the link defect. Automated axe WCAG 2 A/AA, 2.1 AA and 2.2 AA tagged checks, document horizontal overflow and common text-element clipping passed across all 42 combinations. These checks and thumbnail review do not replace assistive-technology/user testing or exhaustive pixel-level inspection.

| Screen | Audit observations / outcome |
| --- | --- |
| Mission Control | Cards and stats stack on mobile; demo disclosure and dependency navigation remain visible |
| Evidence Graph | Filters stack, graph viewport bounded; dense labels on mobile require zoom/pan or textual dependency list; graph nodes may intentionally lie beyond canvas viewport |
| Scenario Lab | Alternatives stack at tablet/mobile; selection and uncertainty retained; main CTA now opens policy review |
| Decision Firewall | Per-scenario FAILED counts 3/1/0 and UNKNOWN support condition stay consistent; main CTA now opens Plan |
| Prevention Plan | Individual action checkboxes, evidence, confirmation and disabled live execution remain visible; main CTA opens Passport; A/B explicitly have no authored plan |
| Prevention Passport | Same selected scenario, no fabricated approval timeline; export/print controls visible; uncertainty and fixture labeling persist |
| Settings | Theme/data controls and integration-unavailable recovery remain reachable; no fake connection state |

Fixed the skip link showing over navigation in full-page mobile capture by using clipped off-focus styling. Found and fixed its route bug: activating href=#main previously reset the hash-driven screen to Mission Control. It now moves keyboard focus to main without changing the selected screen. A mobile keyboard regression test verifies this. Mobile navigation intentionally scrolls horizontally within its own rail; the document has no horizontal overflow.

The primary journey now progresses Scenario Lab → Firewall → Plan → Passport. Browser coverage exercises A/B/C using those CTAs, retaining scenario selection, matching policy counts and UNKNOWN states. C exposes authored action review; A/B remain unsupported rather than borrowing C's plan. No fixture approval or execution is reported as a Jira outcome.

## Verification and readiness

- 41 unit tests passed (8 files).
- 26 Playwright tests passed, single worker, including 42 screen/theme/size cases, production isolation, action review, all three decisions, graph interactions, resource recovery, keyboard/history and reliability.
- One graph model benchmark test passed.
- TypeScript, ESLint, Prettier check and Vite production build passed.
- Existing runtime audit records 13 moderate / 5 high advisories; not remediated or reassessed as safe by this milestone. License inventory has ten root-text misses/custom Forge terms requiring release review.

CORE review handoff is ready in docs/integration/CORE_INTEGRATION_REQUIREMENTS.md and src/api/core-handoff.ts. Live integration is BLOCKED on reviewed contracts/bindings, scenario-linked plan/execution identity, structured Passport audit/error envelope, authenticated installation and hosted acceptance. Fixtures are dev/test-only, production excludes authored data, and FixtureClient refuses mutations. Browser success locally is not VERIFIED_FORGE.
