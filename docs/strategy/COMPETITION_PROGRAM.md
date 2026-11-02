# ANTICIPATE — Competition program (CORE), cycle 1 — 2026-11-02

Scope: CORE/architecture only. UI is owned by the EXPERIENCE agent. Status words: IMPLEMENTED · UNIT_TESTED · VERIFIED_ON_REAL_JIRA · VERIFIED_ON_CLEAN_SITE · DEPLOYED_DEV · DEPLOYED_PROD · BLOCKED · NOT_IMPLEMENTED.

## A. Gap analysis (verified state)
| Capability | Status | Evidence |
|---|---|---|
| Jira read (projects, JQL, issue, links, perms) asUser | VERIFIED_ON_REAL_JIRA, DEPLOYED_PROD | P0 run 2026-11-02 11:30 UTC, AVANCEMENT.md |
| Evidence graph (CONFIRMED/INFERRED/UNKNOWN) | VERIFIED_ON_REAL_JIRA | TD-1 graph, 8 nodes / 7 relations |
| Deterministic A/B/C simulation + policies P1–P3 | UNIT_TESTED, VERIFIED_ON_REAL_JIRA | packages/simulation-core tests; UI + MCP runs |
| Plan → per-action approval → leased idempotent execution → post-write verification | VERIFIED_ON_REAL_JIRA (6/6) | plan-a2f3db9f…, TD-7/TD-8 |
| Prevention Passport | VERIFIED_ON_REAL_JIRA (UI + MCP) | MCP call 2026-11-02 |
| MCP tools (3) | VERIFIED via external client (Claude) | session log 2026-11-02 |
| Install via judge link on clean site | VERIFIED_ON_CLEAN_SITE | toskaman5962, install 32676e8b |
| **Continuous Decision Safety (new, this cycle)** | UNIT_TESTED, DEPLOYED_DEV 4.12.0, **VERIFIED_ON_REAL_JIRA** | see §K |
| **Adversarial concurrency hardening (new)** | UNIT_TESTED | test/concurrency.test.ts |
| Teamwork Graph | **BLOCKED** | requires Atlassian allowlisting of the app ID (support request) + new `read:graph:*` scopes |
| Rovo agent "ANTICIPATE Decision Reviewer" (`rovo:agent`, 4 read-only actions, grounded prompt) | IMPLEMENTED, lint OK, DEPLOYED_DEV 4.13.0; **not yet visible in the Rovo @-mention list on one-atlas-euza** (indexing/enablement pending) | manifest.yml |
| Jira workflow validator | NOT_IMPLEMENTED (design note docs/research/WORKFLOW_VALIDATOR.md) | — |
| Judge sample project (`previewSampleProject` read-only, `createSampleProject` with `confirm:true`, asUser, idempotent by role labels, verified, never touches existing issues, no delete) | UNIT_TESTED (3 tests incl. end-to-end analysis on created data), DEPLOYED_DEV; needs UI (handoff) | src/engine/sample.ts |
| README | template-like; to rewrite with EXPERIENCE visuals | — |

Top 10 gaps to an exceptional product: (1) evidence limited to Jira links; (2) no in-app demo bootstrap for judges; (3) UI does not yet surface EVIDENCE_CHANGED reasons; (4) no Rovo agent; (5) no measured impact study; (6) TWG blocked; (7) README/Devpost narrative; (8) zod advisory not properly analysed (§H); (9) only one use case (API retirement) proven; (10) no native enforcement point (workflow validator).

## B. Competitor landscape (Marketplace, verified listings exist; feature claims to re-check before citing in Devpost)
| Product | Main function | ANTICIPATE difference |
|---|---|---|
| Dependency Mapper | visualise/track issue dependencies, planning risk | ANTICIPATE simulates counterfactual changes and enforces approval + verified writes, not just visualisation |
| Dependency Manager / Dependency Signal | link/blocker maps, alerts | no evidence-status model (CONFIRMED/INFERRED/UNKNOWN), no decision record |
| Impact Analysis for Jira | change impact views | ANTICIPATE adds deterministic policy verdicts, human-approved remediation, post-write verification, passport |
| Panaya Foresight | impact analysis for ERP/Salesforce changes | enterprise, non-Forge, not Jira-native decision gating |
| Board Studio / Ganttry | planning, critical path | planning tools, no prevention loop |
**Why choose ANTICIPATE:** it is the only loop that goes *evidence → counterfactual → policy verdict → human-approved prevention → verified Jira outcome → audit passport*, and it now **refuses to act when the evidence changed after approval**. Others stop at "show me the map".

## C. Judge scorecard (indicative, severe)
| Criterion | /10 | Proven | Main risk | Lift |
|---|---|---|---|---|
| Technology | 7.5 | Forge + Jira asUser, MCP, verified writes, CI | Jira-links-only evidence; Preview modules | TWG (if allowlisted), Rovo agent, CDS (done) |
| Design | 6.5 | full connected UI (EXPERIENCE) | dense; EVIDENCE_CHANGED not surfaced | UI handoff §I, demo bootstrap |
| Impact | 6 | real problem, real Jira proof | no measured gain | benchmark study (§E5) |
| Innovation | 7 | counterfactual + verified prevention + CDS | "dependency graph" looks familiar | lead with CDS + evidence epistemics |
| Presentation | 4 (not started) | — | no video yet | 3-min script around the CDS "WOW" |
Disqualification risks: none known (installable link verified, public repo, English docs pending). Remaining compliance work: video, Devpost text, bonus write-up.

## D. Top improvement backlog (impact × feasibility, ordered)
1. **BUILD (done)** Continuous Decision Safety — re-verify live evidence at approval and execution. 2. **BUILD** UI surfacing of EVIDENCE_CHANGED + freshness check (EXPERIENCE). 3. **BUILD** judge sample-project bootstrap with preview + explicit approval + idempotent creation. 4. **BUILD** Rovo agent "Decision Reviewer" over existing actions (bonus Agents alternative; one bonus max — keep MCP as primary). 5. **RESEARCH→BUILD** Teamwork Graph adapter once allowlisted. 6. **BUILD** benchmark study (manual vs ANTICIPATE on annotated dataset). 7. **BUILD** second use case: dependency upgrade / service decommission using components. 8. **BUILD** workflow validator on an isolated test workflow. 9. **BUILD** README + evidence pack. 10. **RESEARCH** zod 4 migration with full contract compatibility suite.
Avoid: fake "AI risk %"; probabilistic incident prediction; mutating MCP tools; Marketplace listing of the jury app (breaks share link); polling loops.

## E. Big bets
1. Continuous Decision Safety (shipped to dev, §K). 2. Context Intelligence Engine via TWG (blocked on allowlist; adapter design: separate port, source-tagged edges, no name-based merging, Jira-only fallback, coverage indicator). 3. Decision Reviewer agent (grounded, deterministic verdicts, read-only actions). 4. Native enforcement (workflow validator reading stored decision state, fail-open with audit). 5. Measured impact study.

## G. Roadmap
- 3–8 Nov: UI handoff for CDS; TWG allowlist request; demo-bootstrap design + backend.
- 9–22 Nov: demo bootstrap (backend+UI), TWG adapter if allowlisted, benchmark harness.
- 23 Nov–6 Dec: Rovo agent, second use case, workflow validator spike.
- 7–14 Dec: clean-site rehearsal, evidence pack, README, video script.
- 15–19 Dec: freeze, prod deploy (owner authorization), video, Devpost draft. 20–22 Dec: buffer.

## H. Security & reliability (this cycle)
- **Found & fixed: expired-lease takeover race.** Old code: every contender that found an expired lease overwrote it and proceeded → parallel executors → possible duplicate issue creation (marker search happens before create in each). Fix: takeover requires an atomic `setIfAbsent` claim unique to the expired lease token; leases are released only by their holder. Test: 4 contenders on a crashed lease → exactly 1 runs, 2 issues created (not 4+). Note: correctness relies on KVS `FAIL_IF_EXISTS` atomicity (documented Forge behaviour, not independently load-tested).
- 10 simultaneous executions → exactly 1 succeeds, 9 CONFLICT, no duplicates. Cross-user execute/freshness → PERMISSION_DENIED, zero writes.
- **Zod advisory (GHSA-mrhx-c7xc-m3w5):** honest assessment — `.max()` bounds are checked by zod *during* parsing, so a hostile oversized array is still iterated; the Forge resolver payload limit is the real ceiling. Inputs reaching zod come only from our own UI/MCP actions over authenticated Forge invoke. Residual risk: low (authenticated self-DoS of one invocation). Correct fix = zod 4 migration with the contracts test-suite; scheduled in backlog #10, not done blind.
- Open: KVS growth (no TTL cleanup of old snapshots/plans) — add expiry/cleanup before release.

## I. Frontend handoff
See docs/coordination/CORE_TO_EXPERIENCE_HANDOFF.md.

## K. Actual code changes this cycle
- `src/engine/drift.ts` (pure diff), `src/engine/service.ts` (`checkPlanFreshness`, guards at approve/execute, lease takeover fix, holder-only release), `packages/contracts` (EvidenceDrift, `EVIDENCE_CHANGED` error + plan status, `checkPlanFreshness` op, `CONTRACT_FEATURES`), `src/rovo.ts` + manifest (MCP tool `anticipate-check-plan-freshness`), tests `test/drift.test.ts`, `test/concurrency.test.ts`.
- Tests: backend 28/28 (was 19), contracts 3/3, simulation 8/8; typecheck OK; forge lint clean.
- Deployed: **development 4.12.0 only** (production untouched at 2.3.0 — awaiting explicit owner authorization).
- **Hosted proof (real Jira, one-atlas-euza, 2026-11-02 ~14:30 UTC):** plan `plan-4ac3c031-9176-45d3-826a-65eea4f6e92d` (scenario B) approved (approval-time freshness check passed) → a new Jira link "TD-6 is blocked by TD-1" was added in Jira → Execute → server refused: plan status **EVIDENCE_CHANGED**, **0 execution records, 0 Jira writes** (confirmed via MCP `anticipate-get-passport`). The TD-6→TD-1 link was left in place as part of the demo dataset.
- Incident during rollout: contract version bumped to 0.3.0 broke the EXPERIENCE client (it pins 0.2.0 exactly) → reverted wire version to 0.2.0 within minutes, additions advertised via `CONTRACT_FEATURES`.
