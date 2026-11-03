# Jury evidence pack (CORE)

**How to read this pack.** Every result carries one label:
- **LIVE_FORGE**: observed on a deployed Forge app on a real Jira Cloud site. The row or section names the site (`one-atlas-euza` = development, `toskaman5962` and `anticipate-judge` = production installs) and the date.
- **LOCAL**: unit tests, synthetic benchmarks or Playwright with a mock backend (MOCK_TRANSPORT). This is proof of logic or UI behaviour, not of a hosted result.

Screens captured with MOCK_TRANSPORT are never hosted proof, even when they show "live mode" (the harness labels them on screen). Hosted proofs still missing are listed at the end.

| Feature | Commit/branch | Env (label) | Dataset | Date | Procedure | Expected | Observed | Limitation |
|---|---|---|---|---|---|---|---|---|
| Install via judge link on clean site | prod 2.1.0+ | toskaman5962 (prod) · LIVE_FORGE | none | 2026-11-02 | open docs/submission/INSTALL_LINK.md, Get app, choose site | install OK, app opens, honest empty state | "Installation successful"; "No projects available… no demonstration project is inserted" | sample project needs UI button |
| Real Jira read + evidence graph | dev | one-atlas-euza · LIVE_FORGE | TD-1…TD-8 | 2026-11-02 | Mission Control → TD → TD-1 → snapshot | CONFIRMED/INFERRED edges from real links | 8 nodes / 7–8 relations | Jira links only (TWG pending) |
| A/B/C simulation + policies | dev | one-atlas-euza · LIVE_FORGE | TD | 2026-11-02 | Scenario Lab (replacement TD-5) | A BLOCKED, B NEEDS_REVIEW, C PASS | as expected | deterministic; no probabilities by design |
| Approved writes + verification | dev | one-atlas-euza · LIVE_FORGE | TD | 2026-11-02 11:30 UTC | approve 6 actions, execute | 6 VERIFIED, TD-7/TD-8 created and "block" TD-1 | 6/6 VERIFIED; Jira page shows links + decision comment | — |
| Prevention Passport | dev | one-atlas-euza · LIVE_FORGE | plan-a2f3db9f… | 2026-11-02 | MCP get-passport | COMPLETED, 6 VERIFIED | as expected | — |
| Continuous Decision Safety | 070b0f6+ | one-atlas-euza dev 4.12.0 · LIVE_FORGE | plan-4ac3c031… | 2026-11-02 ~14:30 UTC | approve → add Jira link TD-6 blocked by TD-1 → execute | refused, 0 writes | status EVIDENCE_CHANGED, 0 executions | at the time the UI did not show the reason; it now lists added/removed/unknown links (LOCAL, MOCK_TRANSPORT tests), hosted re-check pending (#64) |
| MCP (external client) | dev | Claude connector, one-atlas-euza · LIVE_FORGE | TD | 2026-11-02 | get-graph / simulate-retirement / get-passport | grounded read-only answers | as expected | requires admin "Expose tools" toggle per site |
| Benchmark | feat/core-engine | LOCAL (synthetic) | synthetic 200 graphs | 2026-11-02 | npm test | P=R=1 vs oracle | see BENCHMARK.md | synthetic |
| Rovo agent | dev 4.13.0+ | one-atlas-euza · LIVE_FORGE | — | 2026-11-02 | Jira issue → Agents → search | agent listed | NOT FOUND yet ("check the agent is enabled in Studio"); **superseded the same day: the agent answered in Rovo chat on dev, see "Hosted verification, 2 Nov 2026" below** | needs Rovo Studio enablement by admin |
| Teamwork Graph | exp/teamwork-graph | dev 5.0.0-5.1.0 (one-atlas-euza) · LIVE_FORGE attempt | MOBL-58 | 2026-11-03 | deploy with graph scopes, consent, probe | graph relations | BLOCKED: restricted scope, consent grants no graph scope; ECOHELP-180616 | docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md |

## Hosted verification, 2 Nov 2026 (main fda93de + CORE fixes) · LIVE_FORGE

- Production 2.7.0 deployed from main (includes EXPERIENCE PR #9). Judges' clean site (toskaman5962) loads Mission Control with the "Sample Jira data" panel.
- Rovo agent "ANTICIPATE Decision Reviewer" answered in Rovo chat on the dev site (one-atlas-euza) with grounded, tool-backed output.
- Sample data flow on dev, project MP (company-managed software): preview (read-only) -> confirm -> 6 labelled issues MP-5..MP-10 and 4 Blocks links created and re-read from Jira (MP-5 blocks MP-6, MP-7, MP-9; MP-6 blocks MP-8). Re-preview shows every item EXISTS (idempotent). "Analyze MP-5" builds a CONFIRMED evidence graph.
- Bug found and fixed: on a service-desk project (HAM) the preview promised creation but every write was rejected. Issue types now come from createmeta (types the user can actually create), so such projects are refused up front. Jira 400 details are now logged.
- Known UI issue for EXPERIENCE at the time: the create call could exceed the frontend timeout (TIMEOUT shown although all writes succeeded). Since fixed in the UI (automatic read-only re-check instead of a TIMEOUT error, added after PR #14); the hosted CONFLICT path was verified on dev on 3 Nov (see `docs/coordination/CORE_TO_EXPERIENCE_HANDOFF.md`).

## Jira workflow validator, verified hosted (2 Nov 2026) · LIVE_FORGE, dev site one-atlas-euza

- Isolated company-managed project AVT ("ANTICIPATE Validator Test") on the dev site, with its own workflow "Software Simplified Workflow for Project AVT" (used by 1 space only). No existing workflow touched.
- Validator "ANTICIPATE Decision Firewall" added to the transition into "En cours" and published.
- AVT-1 (label anticipate-change, no decision): transition refused by Jira, HTTP 400: "ANTICIPATE Decision Firewall: AVT-1 cannot move forward because no ANTICIPATE decision has been recorded..." Status stays Backlog.
- AVT-2 (no label): transition accepted (HTTP 204), status En cours.
- The COMPLETED-decision pass path was covered here by unit tests only (LOCAL, validator.test); it was later observed hosted on the judge site (JDG-1 opened after the real migration, 3 Nov, section below).

## Dependency upgrade use case (2 Nov 2026)

- New engine operation UPGRADE_NODE (breaking or compatible). Scenarios: A breaking upgrade now, B backward-compatible shim, C migrate consumers first then upgrade. New read-only action and MCP tool `anticipate-simulate-upgrade`, wired to the Rovo agent.
- Unit tests (LOCAL): breaking upgrade reaches the same consumers as removal but triggers no removal-only rules; compatible upgrade has zero impact.
- Hosted (LIVE_FORGE, one-atlas-euza dev 4.19.0), Rovo chat with the ANTICIPATE Decision Reviewer: "breaking upgrade of MP-5, MP-9 as new version" returned A NEEDS_REVIEW (3 impacted, 2 direct, rule P3), B PASS (0 impacted).

## Hosted verification, 3 Nov 2026 (main 0e37a1e to e24baf4; dev 4.37-6.0, prod 2.25-2.27) · LIVE_FORGE, dev = one-atlas-euza

| Feature | Env | Procedure | Expected | Observed |
|---|---|---|---|---|
| Validator outage policy, admin | dev | Settings: Allow to Block (confirm), reload, back to Allow | persisted, timestamped | PASS (12:03, 13:08, 13:09) |
| Outage policy, Cancel | dev | Block then Cancel, reload | nothing saved | PASS (still Allow, 12:03) |
| Outage policy, non-admin | dev | invited account opens Settings | read-only, no control | PASS (Orphee, capture evidence/experience/v4-ux/settings-validator-policy-non-admin-LIVE_FORGE-dev.png) |
| R17 gate in Passport | dev | MOBL-58 "Migrate first" Passport | Jira transition CLOSED with reason | PASS |
| Passport "In short" (PR #39) | dev 4.39.0 | MOBL-58 Passport | summary of option, verified actions, gate | PASS |
| Passport print to PDF (A4) | dev | MOBL-58 Passport, Print or save as PDF | readable A4, gate and reason included | PASS: 3 A4 pages (checked: `pdfinfo`), evidence/core/passport-MOBL-58-LIVE_FORGE-dev-2026-11-03.pdf |
| Validator on gated issue, BLOCK policy | dev, AVT-9 | transition En cours | refused with a reason | PASS ("no ANTICIPATE decision has been recorded") |
| R18 unreadable issue (403/404) | dev, AVT | reporter-only issue security | 403 path follows policy | NOT REPRODUCIBLE hosted: the app still reads restricted issues on this site; proof is LOCAL only (6 unit tests) |
| MCP after rollback | dev 6.0.0 | get-passport plan-3d6ca859 | COMPLETED, VERIFIED | PASS |

## Clean-site judge run, 3 Nov 2026, 13:55-14:02 Paris (PRODUCTION, public install link) · LIVE_FORGE

Site: anticipate-judge.atlassian.net, created 3 Nov 2026 on the Jira Free plan; no prior data. Project JDG (company-managed Kanban, created empty). Installation f4a739e5 (production environment, from the public link in docs/submission/INSTALL_LINK.md, "Get app" then site selection).

| Step | Expected | Observed |
|---|---|---|
| Install via public link | installs on the chosen site | PASS (forge install list: production, Up-to-date) |
| Open app | Mission Control, no extra consent | PASS (app loaded, "Connected, live mode") |
| Guided demo, choose project | JDG listed as "empty" | PASS |
| Preview sample data | 6 issues + 4 links "Will be created", no write | PASS |
| Confirm creation | 6 tickets and 4 Blocks links created and re-read | PASS: JDG-1..JDG-6, 4 links "Created, verified in Jira" |
| Re-preview | no duplicates | PASS: all "Already in Jira, reused" |
| Analyze JDG-1 | Evidence Graph from real links | PASS: 5 records, Confirmed and Inferred |
| Scenario Lab | 3 options compared | PASS: suggestion "Migrate first" |
| Decision Firewall | verdict with reasons | PASS: Pass, with the "what-if" warning |
| Plan | proposed actions with permission and verification | PASS: 1 action (decision comment on JDG-1) |
| Approval | bound to the plan version | PASS (plan version 9bf0faaa66f1492e) |
| Execution | written and verified in Jira | PASS: VERIFIED at 14:01 (plan-a0e742f7) |
| Prevention Passport | Completed, In short, gate | PASS: Completed, 1 of 1 verified, Jira transition reported as refused by the validator |

Not covered on this run: limited-permission users (Jira Free has no custom permission schemes; covered by unit tests), the workflow validator on JDG (not added to the JDG workflow), and print to PDF.

## Workflow validator on the clean judge site, 3 Nov 2026, 15:00-15:06 Paris (PRODUCTION, anticipate-judge) · LIVE_FORGE
Setup: the "ANTICIPATE Decision Firewall" validator (production extension `.../4d3acc12-4ae2-4391-ae84-ea853b078830/static/anticipate-decision-firewall`) added to the JDG workflow transition "En cours" (workflow version 0 to 1, via the Jira workflows update API). Default outage policy (Allow).

| Case | Expected | Observed |
|---|---|---|
| JDG-6, no `anticipate-change` label | passes | PASS (204) |
| JDG-1, labelled, plan "Migrate first" COMPLETED but consumers still linked (R17) | CLOSED with reason | PASS: refused, "assumes work that Jira does not show as done yet (consumers still depend on it)" |
| Consumers actually migrated (links JDG-1 blocks JDG-2 and JDG-3 removed), re-analysis: "Remove now" PASS (0 affected), new plan approved and executed (VERIFIED 15:05) | OPEN | PASS: JDG-1 moved to "En cours" (204) |

Cleanup: JDG-6 and JDG-1 back to Backlog. The two removed consumer links are part of the scenario (the migration); "Preview sample data" will offer to recreate them.

## What-if slip simulation, hosted on dev, 3 Nov 2026 16:30 Paris (dev 6.2.0, one-atlas-euza) · LIVE_FORGE (Rovo action; the Scenario Lab panel itself is LOCAL-tested only)
Test data (dev test project MP): due dates MP-5 01 Dec, MP-6 04 Dec, MP-7 06 Dec, MP-8 08 Dec, MP-9 09 Dec; version "Winter release (test)" 10 Dec on MP-8. Links: MP-5 blocks MP-6 and MP-7; MP-6 blocks MP-8; MP-5 relates to MP-9.
Rovo agent "ANTICIPATE Decision Reviewer", question "What happens to our dates and releases if MP-5 slips 4 days?" → action anticipate-simulate-slip:
MP-5 01→05 Dec, MP-6 04→08 Dec, MP-7 06→10 Dec, MP-8 08→12 Dec (+4 d each, via the blocks chain); "Winter release (test)" late by 2 days because of MP-8; MP-9 (relates to) not moved; assumptions listed; "no Jira data was modified". PASS.

## K4 cold start after memoryMB 1024 (dev 6.3.0, 3 Nov 2026 ~16:40 UTC) · LIVE_FORGE

Site one-atlas-euza (development), built-in browser, Resource Timing on the Jira page (the two resolver invocations go through `gateway/api/graphql/pq/17357…`, started in parallel).

| Load | Invocation durations | Data received after navigation start |
|---|---|---|
| First open after the 6.3.0 deploy (~20 min, no prior app traffic seen) | 1582 ms, 1607 ms | ~3.9 s |
| Reload (warm) | 569 ms, 416 ms | ~2.6 s |

Baseline before the change: 8 to 11 s first open (RELEASE.md). Limits: one cold sample only; "cold" is inferred from no traffic since deploy, not confirmed in Forge logs; Jira page load itself (~2 s) is outside the app's control. Production (judge site) not re-measured: it still runs the previous version until a production deploy.

## Production 2.30.0 (3 Nov 2026, ~17:30 UTC) — first open after deploy · LIVE_FORGE, toskaman5962

Deployed by the owner from `main` d995021 (memoryMB 1024, slip simulation, ORP-6/7). Site toskaman5962 (production install from the public link), built-in browser pane visible, Resource Timing on the Jira page. App shows "Connected · live mode".

| Load | CDN page for the app | First resolver calls start | Invocation durations | Data received |
|---|---|---|---|---|
| First open right after deploy (CDN and browser cache cold) | 2197 ms | 7.2 s | 2102 ms, 1491 ms | ~9.3 s |
| Reload (warm) | 28 ms | 2.0 s | 607 ms | ~2.6 s |

Reading: after the memory increase, server time is ~1.5–2.1 s even cold. The rest of a post-deploy first open is static asset delivery (CDN + browser cache cold), not the app backend. Earlier dev sample after ~20 min idle (CDN warm): ~3.9 s. Judges may see the cold-asset case on their very first open.

## Hosted (LIVE_FORGE) proofs still missing

Each of these is either tested LOCAL only or not observed at all. The browser checks belong to muse (#64), and the video belongs to the owner.

| Item | Current proof | What is needed |
|---|---|---|
| "What if it slips?" panel in the Scenario Lab (PRs #61, #70) | LOCAL (Playwright, MOCK_TRANSPORT) | One run on JDG or MP: late release, moved dates, an issue without a due date ("Nothing to move" / Unknown) |
| Evidence-changed refusal showing what changed in the UI | LOCAL | Re-run the drift scenario on dev and capture the notice |
| Passport print with the dark theme selected (PR #60 contrast fix) | LOCAL (axe in print media) | One saved PDF from the hosted site with Dark selected |
| Judge site, non-admin Settings (J2 in `docs/jury/HOSTED_ACCEPTANCE_PR37.md`) | dev only (one-atlas-euza) | The same check on anticipate-judge with an invited account |
| R18: unreadable (403/404) gated issue follows the outage policy | LOCAL (6 unit tests) | A site where issue security actually hides the issue from the app |
| Hosted screenshots for the Devpost gallery | none (gallery has diagrams only) | LIVE_FORGE captures of graph, Scenario Lab, Firewall, Passport |
| Demo video (K1) | none | Recording per `docs/submission/VIDEO_SCRIPT.md` on the hosted judge site |

