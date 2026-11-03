# Jury evidence pack (CORE)

| Feature | Commit/branch | Env | Dataset | Date | Procedure | Expected | Observed | Limitation |
|---|---|---|---|---|---|---|---|---|
| Install via judge link on clean site | prod 2.1.0+ | toskaman5962 (prod) | none | 2026-11-02 | open docs/submission/INSTALL_LINK.md, Get app, choose site | install OK, app opens, honest empty state | "Installation successful"; "No projects available… no demonstration project is inserted" | sample project needs UI button |
| Real Jira read + evidence graph | dev | one-atlas-euza | TD-1…TD-8 | 2026-11-02 | Mission Control → TD → TD-1 → snapshot | CONFIRMED/INFERRED edges from real links | 8 nodes / 7–8 relations | Jira links only (TWG pending) |
| A/B/C simulation + policies | dev | one-atlas-euza | TD | 2026-11-02 | Scenario Lab (replacement TD-5) | A BLOCKED, B NEEDS_REVIEW, C PASS | as expected | deterministic; no probabilities by design |
| Approved writes + verification | dev | one-atlas-euza | TD | 2026-11-02 11:30 UTC | approve 6 actions, execute | 6 VERIFIED, TD-7/TD-8 created and "block" TD-1 | 6/6 VERIFIED; Jira page shows links + decision comment | — |
| Prevention Passport | dev | one-atlas-euza | plan-a2f3db9f… | 2026-11-02 | MCP get-passport | COMPLETED, 6 VERIFIED | as expected | — |
| Continuous Decision Safety | 070b0f6+ | one-atlas-euza dev 4.12.0 | plan-4ac3c031… | 2026-11-02 ~14:30 UTC | approve → add Jira link TD-6 blocked by TD-1 → execute | refused, 0 writes | status EVIDENCE_CHANGED, 0 executions | UI does not yet show the reason |
| MCP (external client) | dev | Claude connector, one-atlas-euza | TD | 2026-11-02 | get-graph / simulate-retirement / get-passport | grounded read-only answers | as expected | requires admin "Expose tools" toggle per site |
| Benchmark | feat/core-engine | local | synthetic 200 graphs | 2026-11-02 | npm test | P=R=1 vs oracle | see BENCHMARK.md | synthetic |
| Rovo agent | dev 4.13.0+ | one-atlas-euza | — | 2026-11-02 | Jira issue → Agents → search | agent listed | NOT FOUND yet ("check the agent is enabled in Studio") | needs Rovo Studio enablement by admin |
| Teamwork Graph | exp/teamwork-graph | dev 5.0.0-5.1.0 | MOBL-58 | 2026-11-03 | deploy with graph scopes, consent, probe | graph relations | BLOCKED: restricted scope, consent grants no graph scope; ECOHELP-180616 | docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md |

## Hosted verification, 2 Nov 2026 (main fda93de + CORE fixes)

- Production 2.7.0 deployed from main (includes EXPERIENCE PR #9). Judges' clean site loads Mission Control with the "Sample Jira data" panel.
- Rovo agent "ANTICIPATE Decision Reviewer" answered in Rovo chat on the dev site with grounded, tool-backed output.
- Sample data flow on dev, project MP (company-managed software): preview (read-only) -> confirm -> 6 labelled issues MP-5..MP-10 and 4 Blocks links created and re-read from Jira (MP-5 blocks MP-6, MP-7, MP-9; MP-6 blocks MP-8). Re-preview shows every item EXISTS (idempotent). "Analyze MP-5" builds a CONFIRMED evidence graph.
- Bug found and fixed: on a service-desk project (HAM) the preview promised creation but every write was rejected. Issue types now come from createmeta (types the user can actually create), so such projects are refused up front. Jira 400 details are now logged.
- Known UI issue for EXPERIENCE: the create call can exceed the frontend timeout (TIMEOUT shown although all writes succeeded). Re-preview recovers correctly.

## Jira workflow validator, verified hosted (2 Nov 2026)

- Isolated company-managed project AVT ("ANTICIPATE Validator Test") on the dev site, with its own workflow "Software Simplified Workflow for Project AVT" (used by 1 space only). No existing workflow touched.
- Validator "ANTICIPATE Decision Firewall" added to the transition into "En cours" and published.
- AVT-1 (label anticipate-change, no decision): transition refused by Jira, HTTP 400: "ANTICIPATE Decision Firewall: AVT-1 cannot move forward because no ANTICIPATE decision has been recorded..." Status stays Backlog.
- AVT-2 (no label): transition accepted (HTTP 204), status En cours.
- The COMPLETED-decision pass path is covered by unit tests (validator.test).

## Dependency upgrade use case (2 Nov 2026)

- New engine operation UPGRADE_NODE (breaking or compatible). Scenarios: A breaking upgrade now, B backward-compatible shim, C migrate consumers first then upgrade. New read-only action and MCP tool `anticipate-simulate-upgrade`, wired to the Rovo agent.
- Unit tests: breaking upgrade reaches the same consumers as removal but triggers no removal-only rules; compatible upgrade has zero impact.
- Hosted (dev 4.19.0), Rovo chat with the ANTICIPATE Decision Reviewer: "breaking upgrade of MP-5, MP-9 as new version" returned A NEEDS_REVIEW (3 impacted, 2 direct, rule P3), B PASS (0 impacted).

## Hosted verification, 3 Nov 2026 (main 0e37a1e to e24baf4; dev 4.37-6.0, prod 2.25-2.27)

| Feature | Env | Procedure | Expected | Observed |
|---|---|---|---|---|
| Validator outage policy, admin | dev | Settings: Allow to Block (confirm), reload, back to Allow | persisted, timestamped | PASS (12:03, 13:08, 13:09) |
| Outage policy, Cancel | dev | Block then Cancel, reload | nothing saved | PASS (still Allow, 12:03) |
| Outage policy, non-admin | dev | invited account opens Settings | read-only, no control | PASS (Orphee, capture evidence/experience/v4-ux/settings-validator-policy-non-admin-LIVE_FORGE-dev.png) |
| R17 gate in Passport | dev | MOBL-58 "Migrate first" Passport | Jira transition CLOSED with reason | PASS |
| Passport "In short" (PR #39) | dev 4.39.0 | MOBL-58 Passport | summary of option, verified actions, gate | PASS |
| Passport print to PDF (A4) | dev | MOBL-58 Passport, Print or save as PDF | readable A4, gate and reason included | PASS: 2 pages, evidence/core/passport-MOBL-58-LIVE_FORGE-dev-2026-11-03.pdf |
| Validator on gated issue, BLOCK policy | dev, AVT-9 | transition En cours | refused with a reason | PASS ("no ANTICIPATE decision has been recorded") |
| R18 unreadable issue (403/404) | dev, AVT | reporter-only issue security | 403 path follows policy | NOT REPRODUCIBLE: the app still reads restricted issues on this site; unit tests (6) are the proof |
| MCP after rollback | dev 6.0.0 | get-passport plan-3d6ca859 | COMPLETED, VERIFIED | PASS |

## Clean-site judge run, 3 Nov 2026, 13:55-14:02 Paris (PRODUCTION, public install link)

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
