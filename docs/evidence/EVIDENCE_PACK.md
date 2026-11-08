# Jury evidence pack (CORE)

**How to read this pack.** Every result carries one label:
- **LIVE_FORGE**: observed on a deployed Forge app on a real Jira Cloud site. The row or section names the site (`one-atlas-euza` = development, `toskaman5962` and `anticipate-judge` = production installs) and the date.
- **LIVE_FORGE_DEV**: LIVE_FORGE observed specifically on the development site (`one-atlas-euza`).
- **LIVE_FORGE_PRODUCTION**: LIVE_FORGE observed specifically on a production install (`toskaman5962` or `anticipate-judge`).
- **UNIT_TESTED**: covered by automated unit tests only; not observed on any hosted site.
- **NOT_VERIFIED**: built but not yet demonstrated in the stated scope (e.g. an external MCP client run, a hosted event).
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

## Production 2.37.0: Release Safety, release overview, Safe Change Composer, Decision Time Machine (5 Nov 2026, 13:13–13:17 UTC) · LIVE_FORGE_PRODUCTION, toskaman5962

Source: main 8262f88 (after #177), deployed through the bridge `deploy-prod`. The manifest is unchanged since 2.36.0, so there is no re-consent. Site: toskaman5962 (site admin = owner account), dedicated sample project ADM. Opened at `/apps/full-page/<installation-id>/hello-world/`; the installation id comes from the GraphQL `ecosystem.appInstallationsByApp` query.

| Feature | Procedure | Expected | Observed | Screenshot |
|---|---|---|---|---|
| Release overview (#177) | Mission Control → ADM → "Show all releases needing attention" | ADM change issues grouped by fixVersion | 1 group "No release (unscheduled)", Needs review, 1 change, 0 interactions | hosted-2026-11-05/release-overview-ADM-prod-2.37.0.jpg |
| Release Safety (#173) | Click the group | Per-change state + Jira link + unknowns | ADM-1 Needs review, "No ANTICIPATE decision of yours is recorded"; link to ADM-1; "What this check cannot know (2)" | hosted-2026-11-05/release-safety-ADM-prod-2.37.0.jpg |
| Portfolio (existing) | Scenario Lab, Change 1 = migrate ADM-1 → ADM-5, Change 2 = breaking upgrade ADM-5 | DEMO 2 collision | EMERGENT_IMPACT on ADM-2/3/4 + MIGRATE_ONTO_RETIRED | hosted-2026-11-05/portfolio-ADM-prod-2.37.0.jpg |
| Safe Change Composer (#176) | "Compose safer alternatives" | Compatibility phase ranked first | #1 "Compatibility phase for ADM-5": blockers 0, conflicts 0, impacted 0, assumption stated; #2 As proposed: conflicts 2, impacted 3; #3 Split: conflicts 2 | hosted-2026-11-05/composer-ADM-prod-2.37.0.jpg |
| Decision Time Machine (#174) | Compare options → Retain temporarily → generate plan → "Check evidence freshness" → Passport | Recorded checkpoints | "Evidence captured 13:14 UTC" + "Re-check 13:16 UTC", both unchanged; status pending approval; no recorded difference | hosted-2026-11-05/time-machine-ADM-prod-2.37.0.jpg |

Jira writes in this session: none. Plan generation and the freshness check are app storage only; nothing was approved or executed.
**Invalidation, same plan (plan-43328562…), 13:21–13:23 UTC · LIVE_FORGE_PRODUCTION**
1. Approved 1 action (approval only, 0 Jira writes) → checkpoint "Check at approval 13:21 UTC", evidence unchanged.
2. Added a Jira link on the dedicated sample project, as the owner account, through Jira REST: link #10004, ADM-1 ↔ ADM-6 "Blocks", 13:22:03 UTC. This is the only Jira write of the session.
3. **Decision Radar in production**: "Link created · Blocks, occurred 14:22 CET, observed 14:22 CET", Needs review. This is the first production observation of Radar event delivery (radar-link-created-ADM-prod-2.37.0.jpg).
4. Re-check → "CHANGED … 1 new dependency relation(s)". The plan cannot execute; the added relation is listed: `issue:ADM-1 DEPENDS_ON issue:ADM-6 [CONFIRMED]` (plan-invalidated-ADM-prod-2.37.0.jpg).
5. Passport → Decision Time Machine: "Why this decision is blocked now", 4 checkpoints (captured, re-check, check at approval, re-check **Evidence changed** 13:22 UTC); comparing captured with the last check shows **Added: ADM-1 depends on ADM-6** (time-machine-invalidated-ADM-prod-2.37.0.jpg).

UI defect found: after the re-check, the plan and Passport header badges still showed "Approved · not executed" although the backend had invalidated the plan (the Time Machine, read from the backend, was correct). Fixed in the following PR: a CHANGED re-check now re-reads the recorded plan.
Cleanup: link #10004 is kept as demo data for the video. Remove it to reset ADM.
Text polish found during this run (fixed in the following PR): raw enums in reasons ("NEEDS_REVIEW", "PENDING_APPROVAL") and "issue:ADM-5" in a Composer sentence.

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

## Slip panel on the judge site (3 Nov 2026, ~22:40 UTC) · LIVE_FORGE, anticipate-judge (production 2.30.0)

Built-in browser pane visible, signed in with the judge-site account. Mission Control → project JDG → JDG-1 → Analyze dependencies (2 records: JDG-1 affects JDG-5, Inferred) → Scenario Lab → "What if it slips?" → 10 days.

| Check (#64) | Observed | Result |
|---|---|---|
| Panel reachable after analysis, read-only badge | "Simulation · nothing changed in Jira" | PASS |
| Headline | "If JDG-1 slips 10 days: no release would be late, 0 due dates would move, 1 item cannot be assessed." | PASS (honest) |
| Unknown items in the warning block | "Cannot be assessed (not assumed safe): JDG-1: no due date in Jira, Path: JDG-1" | PASS |
| Late releases listed first, each moved date shows its path | not observable: the guided-demo sample tickets have no due dates or fix versions, so nothing moves | NOT TESTED HOSTED (follow-up ORP-30 #121 seeds due dates) |
| Passport printed on paper in dark theme | needs a physical print | owner (manual) |

## Production 2.31.0 outage and 2.32.0 hotfix (3 Nov 2026, ~22:45-23:00 UTC) · LIVE_FORGE, anticipate-judge

- 22:45 UTC: production 2.31.0 deployed from main (K5–K8). On anticipate-judge the app showed "Backend connection unavailable — INTERNAL: Unexpected server error" (requests fadd2afd…, 4bbacac2…), retry did not help.
- Cause: the K8 throttle (#109) built its Forge KVS key from `installContext`, an ARI containing "/" (`ari:cloud:jira::site/<cloudId>`). Forge KVS keys only accept `[a-zA-Z0-9:._ -#]`, so every resolver call threw before running. Unit tests used an in-memory store and could not catch it; dev 6.5.0 had the same defect but was not opened after deploy.
- Fix: `throttleKey` maps disallowed characters to `_`, and the throttle fails open on any storage error (abuse control must never take the app down). 2 regression tests (backend 144/144). Deployed dev 6.6.0 and production 2.32.0 at ~22:55 UTC.
- After 2.32.0 (#53 partial, built-in browser pane visible, first open right after deploy): "Connected · live mode"; CDN app page 2144 ms, resolver invocations 1220 ms and 1479 ms, data received ~8.4 s. Analyze JDG-1: invocations 1333 ms + 237 ms, graph shown ~2.0 s after the click. 10-parallel burst not run (the browser pane reuses one tab per URL).

## #64 hosted checks on dev (4 Nov 2026, 18:15–19:10 CET) · LIVE_FORGE_DEV, one-atlas-euza

Built-in browser pane, owner session (site admin). Dev 6.18.x until 19:05, then 6.19.0 (main 3668327). Jira writes on TD were authorised by the owner in chat. Pane screenshots (760 px) kept by the owner; not gallery quality.

| Check | Observed | Result |
|---|---|---|
| Analyze TD-1 | 8/8 records, TD-4 at 2 hops, TD-5 edge Inferred | PASS |
| Scenario Lab (retire, no replacement) | suggested Retain temporarily: 4 affected, 0 blockers; Remove now triggers P1 | PASS |
| What if it slips? — no due dates | "no release would be late, 0 due dates would move, 5 items cannot be assessed", each with its path | PASS |
| What if it slips? — dated sample (TD-1 11-15, TD-2 11-20, TD-4 11-26 + version "ANTICIPATE demo release 1.0" 11-27) | "1 release would be late, 3 due dates would move, 2 items cannot be assessed"; release late by 9 d because of TD-4; TD-1→11-25, TD-2→11-30, TD-4→12-06 with paths; TD-3/TD-6 unknown | PASS |
| Evidence-changed refusal in the UI (plan-522a2808…) | approval recorded, then link TD-5 blocks TD-3 added; execute → "Evidence changed — this plan cannot execute", Added relations `issue:TD-3 DEPENDS_ON issue:TD-5 [CONFIRMED]`, removed/unknown none (request 63c50286…); TD-2 labels unchanged (changelog: last change 2 Nov); link removed after | PASS, 0 writes |
| Clean execution + Passport (plan-2fe13c50…, 1 action) | decision comment on TD-1 Verified (attempt 1, 18:21 CET); Passport timeline ends "Execution finished: 1/1 verified"; limitations list the 4 unexecuted actions | PASS |
| Decision Radar on new plans | before #158: "Monitoring degraded · An event could not be interpreted" on every plan although the day's link events were RECORDED (forge logs); after #158 on 6.19.0 (19:10 CET): "Listening", 8 indexed | FIXED |
| Passport PDF, dark theme | print dialog blocks automation | owner (manual) |

## DEMO 2 — portfolio collision on dev (4 Nov 2026, 21:08 CET) · LIVE_FORGE_DEV, one-atlas-euza 6.19.0

Built-in browser pane, owner session. Read-only: nothing written to Jira. Mission Control → TD / TD-1 → Analyze → Scenario Lab → Several changes at once:
- Change 1 "A: move TD-1 consumers to TD-5": Migrate dependents, TD-1 → TD-5.
- Change 2 "B: breaking upgrade of TD-5": Upgrade · breaking, TD-5.

| Observed | Result |
|---|---|
| Combined simulation: **Needs review**; evidence coverage incomplete note (Teamwork Graph not allowlisted) | PASS (honest) |
| Conflict 1: "issue:TD-2, issue:TD-3, issue:TD-4, issue:TD-6 are impacted only when the changes run together (not by any change alone)" | PASS (EMERGENT_IMPACT) |
| Conflict 2: "change-1 migrates dependents of issue:TD-1 onto issue:TD-5, but change-2 applies a breaking upgrade to issue:TD-5; the migrated consumers would be impacted again" | PASS (MIGRATE_ONTO_RETIRED) |
| Suggested order: A → B; shared affected records: none | PASS |

Same outcome as `test/demo2-portfolio-collision.test.ts` (#164). Finding: the conflict reasons showed internal ids (`change-1`, `change-2`) instead of the change names; fixed in the same PR (names substituted in reasons, Playwright assertion added).

## DEMO 3 — the decision that became unsafe (4 Nov 2026, 23:42–23:45 CET) · LIVE_FORGE_DEV, one-atlas-euza 6.20.0

Built-in browser pane, owner session. TD-1 → Scenario Lab (Retain temporarily) → Firewall → plan (5 actions, created 23:42 CET); **one** action approved (decision comment on TD-1), status "Approved · not executed".

| Step | Observed | Result |
|---|---|---|
| Jira evidence changes after approval | link 59310 "TD-1 blocks TD-6" deleted via Jira REST at 22:43:37 UTC | — |
| Decision Radar | ~15 s later, Refresh radar: **Needs review**, "Link deleted · Blocks, occurred 23:43 CET, observed 23:43 CET", monitoring Listening, 8 indexed | PASS (live event → attention) |
| Re-check evidence | "Evidence changed — this plan cannot execute": Removed relations `issue:TD-6 DEPENDS_ON issue:TD-1 [CONFIRMED]`; added/unknown none; actions marked "Evidence changed"; "This decision is blocked. Rebuild the snapshot and review a new plan." | PASS (plan invalidated before any execution) |
| Zero writes | TD-1 comments after the run: latest 12:21:37 −05:00 (= 18:21 CET, the earlier verified run); no new comment | PASS |
| Cleanup | link restored as "TD-6 is blocked by TD-1" (new id) | done |

This completes DEMO 3 end to end on hosted Jira (approval → real Jira change → radar attention → evidence re-check → blocked, 0 writes). The execute-time refusal path itself was shown earlier the same day (plan-522a2808…, EVIDENCE_CHANGED on execute).

## DEMO 2 on production (5 Nov 2026, 00:00–00:03 CET) · LIVE_FORGE_PRODUCTION, toskaman5962, v2.36.0

Owner session (site admin), built-in browser pane, at the owner's explicit request ("do it yourself").
1. Created Jira project **ADM "ANTICIPATE Demo"** (company-managed software, Kanban template, lead = owner) via Jira REST: 201, id 10000.
2. In the app: Mission Control → Demo project preparation → Preview (6 tickets, 4 links, all "Will be created") → confirm → **ADM-1…ADM-6 and 4 links "Created · verified in Jira"** (backend read-back).
3. Analyze ADM-1 → Scenario Lab → Several changes at once: A = Migrate dependents ADM-1 → ADM-5; B = Upgrade · breaking ADM-5.

| Observed | Result |
|---|---|
| Combined simulation **Needs review**; coverage note (Teamwork Graph not allowlisted) | PASS |
| “ADM-2, ADM-3, ADM-4 are impacted only when the changes run together (not by any change alone)”; reason names “A: move ADM-1 consumers to ADM-5” + “B: breaking upgrade of ADM-5” | PASS (EMERGENT_IMPACT, #165 named reasons live) |
| “A … migrates dependents of issue:ADM-1 onto issue:ADM-5, but B … applies a breaking upgrade to issue:ADM-5; the migrated consumers would be impacted again” | PASS (MIGRATE_ONTO_RETIRED) |
| Suggested order A → B | PASS |

Simulation itself wrote nothing to Jira; the only writes were the project creation and the app's labelled sample tickets.

## Hosted (LIVE_FORGE) proofs still missing

Each of these is either tested LOCAL only or not observed at all. The browser checks belong to muse (#64), and the video belongs to the owner.

| Item | Current proof | What is needed |
|---|---|---|
| "What if it slips?" panel in the Scenario Lab (PRs #61, #70) | LIVE_FORGE_DEV 4 Nov (TD), see above | Same run on the production judge site |
| Evidence-changed refusal showing what changed in the UI | LIVE_FORGE_DEV 4 Nov, see above | — |
| Passport print with the dark theme selected (PR #60 contrast fix) | LOCAL (axe in print media) | One saved PDF from the hosted site with Dark selected |
| Judge site, non-admin Settings (J2 in `docs/jury/HOSTED_ACCEPTANCE_PR37.md`) | dev only (one-atlas-euza) | The same check on anticipate-judge with an invited account |
| R18: unreadable (403/404) gated issue follows the outage policy | LOCAL (6 unit tests) | A site where issue security actually hides the issue from the app |
| Hosted screenshots for the Devpost gallery | 5 LIVE_FORGE_DEV captures 8 Nov (mission, graph, firewall, plan, passport — docs/evidence/hosted-2026-11-08/) + diagram pack | Judge-site captures on the shipping build (#191) |
| Demo video (K1) | Final cut rendered 7 Nov + QA ACCEPTED 8 Nov (docs/evidence/VIDEO_QA_REPORT.md); genuine dev-8.x footage | Owner full watch + listen, co-owner approval, public YouTube upload + URL (#189) |
| MCP slip + portfolio from an external client (5/7 → 7/7) | UNIT_TESTED + LOCAL rovo tests; dev 8.1.0 carries all 7 tools | One admin-enabled session per `MCP_EXTERNAL_RUNBOOK.md` (#190) |
| Clean-site judge re-run on the shipping build | Judge PASS 3 Nov on an older build; new Explorer/Command Center UI UNIT_TESTED + LOCAL mock-e2e only | `JUDGE_RERUN_CHECKLIST.md` on anticipate-judge incl. new-UI exercise (#191) |


## 4 Nov 2026 — LIVE_FORGE_DEV: 10-parallel burst (#53) and Decision Radar end to end (#132)

Environment: development v6.10.0 (main 8cd6dc6), then redeployed from main 8782a3f (radar fix #150; version number not captured), site one-atlas-euza, signed in as the site owner in the built-in browser. Requests are the app's own `invokeExtension` calls (captured from the running Custom UI and replayed in the page; same user, same context token). Read-only operation for the load test.

### Burst test, `listProjects` (reads Jira), 14:50:18–14:50:37 UTC
| Concurrency | Samples | Success | p50 | p95 | max | wall per burst |
|---|---|---|---|---|---|---|
| 1 | 1 | 1/1 | 847 ms | 847 ms | 847 ms | 0.85 s |
| 5 | 5 | 5/5 | 982 ms | 1827 ms | 1827 ms | 1.83 s |
| 10 (×3 bursts, 2 s apart) | 30 | **30/30** | **757 ms** | **1899 ms** | 1942 ms | 1.84–1.94 s |

No error codes, no RATE_LIMITED (36 identical requests stay under the app's 60-per-window throttle by design). The ~1.8–1.9 s tail matches extra Forge instances starting under concurrency. Limits: one site, one user, one read operation; analysis/compare/execute under load not measured.

### Decision Radar, real Jira events (TD demo project)
1. Plan `plan-298cc464…` generated from TD-1: radar coverage **8 indexed, 0 unindexed**, state ACTIVE, `lastObservedAt` null.
2. 14:51:28.2 UTC: real link TD-4 ↔ TD-6 ("Relates") created via Jira REST. Forge log: `radarOnJiraEvent` invoked at **14:51:31.7 (≈3.5 s)** but returned IGNORED: the live payload did not match the documented flat shape. The plan correctly showed **DEGRADED / INVALID_EVENT**, not "all clear". Fixed in #150 (fields accepted flat or under `issueLink`, missing timestamp tolerated, rejected shapes logged as key names only).
3. 15:07:27.8 UTC: the same link deleted (also cleans up the test data). Event recorded at **15:07:30.96 (≈3.2 s)**: `LINK_DELETED.59324`, issues 66403 / 66405 (TD-4 / TD-6), type Relates; **needsReview: true**.
4. 15:08:40 UTC: `checkPlanFreshness` → fresh (link created then removed: evidence back to the approved state) → attention cleared, state **ACTIVE**, reasons [].
Status: Decision Radar first slice is **LIVE_FORGE_DEV** for link events. Not yet observed live: `avi:jira:deleted:issue`; production event delivery.

### Production
Owner deployed production from main 8cd6dc6 on 4 Nov (~14:40 UTC). Verified on toskaman5962 at ~15:15 UTC: capabilities list `getPlanAttention` and `simulatePortfolio`. Production does not yet include #150 (radar payload fix).

### Burst test, `getGraphSnapshot` (3-hop Jira crawl of TD-1, 8 records; writes a snapshot), 4 Nov ~15:43 UTC, LIVE_FORGE_DEV
| Concurrency | Samples | Success | p50 | p95 | max |
|---|---|---|---|---|---|
| 1 | 1 | 1/1 | 1522 ms | 1522 ms | 1522 ms |
| 5 | 5 | 5/5 | 2369 ms | 2703 ms | 2703 ms |
| 10 (×2 bursts, 2 s apart) | 20 | **20/20** | **1363 ms** | **2636 ms** | 2690 ms |

Same method as the `listProjects` burst (app's own invocations, one user, development, main ea3ee7c). No error codes, no RATE_LIMITED. Small graph (8 nodes): larger graphs are covered only by the synthetic crawl benchmark, not by this hosted test.

### Production after owner deploy (4 Nov ~15:40 UTC, main ea3ee7c)
toskaman5962: startup invocations 1644 / 1412 ms (cold), then `getCapabilities` 325 ms; `getPlanAttention` listed.

### T7-2: dev 8.1.0 deploy record + read-only acceptance (8 Nov 2026) — LIVE_FORGE_DEV, one-atlas-euza

`forge deploy list`: Success, contributor Toska Marley, 2026-11-07T20:34:50Z, second deploy to major 8 (first 18:16Z = 8.0.0), hence 8.1.0 by Forge minor-increment (minor string INFERRED-STRONG). `forge install list`: development/one-atlas-euza major 8 (Latest), Up-to-date. Installed code = RC code (d1e6509/9004bab, docs-only delta). Full record: docs/deployment/DEV_RELEASE_CANDIDATE.md, docs/evidence/HOSTED_ACCEPTANCE_T7.md.

Read-only walk (project capture browser, zero Jira writes): all 6 journey steps live with a consistent context pill (AVT · AVT-3 · Migrate first · Completed). Evidence Graph shows 7 records incl. AVT-1 (drift link persisted); Firewall MIGRATE FIRST Pass with stated assumption; Passport Radar Listening (7 indexed), Time Machine completed with 3 unchanged checkpoints. Capabilities as backend-reported: Jira read/write Available, MCP Permission required, Teamwork Graph Not configured. Perf single sample (warm): first content 189 ms, workspace connected 1675 ms. Screenshots: docs/evidence/hosted-2026-11-08/.

Install-link liveness (8 Nov): HEAD on the INSTALL_LINK.md URL returns 200 (page resolves; full install flow not re-tested here).

### T8: RCC + portfolio DEMO 2 on dev 8.1.0 (8 Nov 2026, ~02:35–02:50 CET) — LIVE_FORGE_DEV, one-atlas-euza

CDP-driven capture browser, owner session, zero Jira writes. Release Command Center digest live on AVT (Unscheduled, 3 changes: AVT-1/AVT-9 Needs review, AVT-3 Blocked COMPLETED—BLOCKED) and on TD (1 change, no cross-project leak after AVT→TD switch). TD-1 analysis: 8 records / 8 relations (6 confirmed, 2 inferred). Portfolio DEMO 2 (A: migrate TD-1→TD-5 + B: breaking upgrade TD-5): Combined Needs review, EMERGENT_IMPACT on TD-2/3/4/6, MIGRATE_ONTO_RETIRED, order A→B. Full record: docs/evidence/HOSTED_ACCEPTANCE_T8.md. Screenshots: docs/evidence/hosted-2026-11-08/20-rcc-td-dev-8x.png, 21-td-analysis-dev-8x.png, 22-portfolio-demo2-dev-8x.png.

### T9 Epsilon: value baseline SELF-RUN #1 (8 Nov 2026, ~13:00 CET) — builder-operated, CONTAMINATED seed, NOT a human study

Task "which issues are affected if TD-1 is retired, incl. indirect consumers" on live TD data, zero Jira writes. Jira-only: 7 page loads, ~40.6 s page time, 8/8 closure only with a methodical 2-hop walk (TD-4 invisible from TD-1's page — 7/8 if stopping there). App cold start: 3 UI actions, 7.2 s to a classified 8-record graph (6 confirmed / 2 inferred). Timings are illustrative lower bounds (operator knew the seed); step counts are the objective structural comparison. Full record + limitations: docs/strategy/VALUE_BASELINE_SELRUN1.md. Screenshot: docs/evidence/hosted-2026-11-08/23-value-app-td-dev-8x.png.

### T9 Final: production 4.0.0 deploy + install-link routing (8 Nov 2026, 13:20:51 UTC) — LIVE_FORGE_PRODUCTION, owner-authorized

RC `5610ca7` deployed to production as **4.0.0** (Forge session Toska Marley; CLI 14.2.0; detached worktree at exact RC commit, manifest hash re-verified, `forge lint` clean). First attempt stopped on MAJOR_VERSION_RULE (latest production was the uninstalled TWG major 3, so the return to the committed 4-scope manifest is a scope change); re-ran with `--approve MAJOR_VERSION_RULE`. cli output: "Deployed ANTICIPATE to the production environment ... version [4.0.0]". Installs: `toskaman5962` → 4 Up-to-date (CLI `--upgrade`); `anticipate-judge` CLI upgrade FAILED (generic "Failed to install into Jira", verbose adds nothing) — site-admin upgrade click required. Install-link routing VERIFIED in the capture browser (consent page read, nothing installed): exactly 4 scopes, no graph scopes — new installs receive 4.0.0. In-app production smoke NOT_VERIFIED (capture session not entitled on toskaman5962). Screenshot: docs/evidence/hosted-2026-11-08/24-install-consent-4x.png. Full record: docs/deployment/PROD_RELEASE_CANDIDATE.md.

### T9 Final: MCP endpoint + OAuth surface mapped (8 Nov 2026) — transport VERIFIED, tools still 5/7

`POST https://mcp.atlassian.com/forge/39a28f48-...` with a bare `initialize` → 401 (endpoint live, Streamable HTTP); `/.well-known/oauth-protected-resource/...` advertises Atlassian OAuth (`auth.atlassian.com`) with account-wide scopes (read:me/account, email, offline_access, Jira/Confluence/Compass/TWG read+write sets). Completing that grant automatically would mint persistent broad-scope owner tokens, so the external session stays owner-gated per MCP_EXTERNAL_RUNBOOK.md (control + slip + portfolio prompts, ~10 min in the owner's own MCP client). Admin "Expose tools" toggle state still UNKNOWN (observable only inside an authenticated session).
