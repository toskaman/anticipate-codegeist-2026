# Video ↔ shipping-build parity matrix (TITAN-8, 8 Nov 2026)

Film: `ANTICIPATE_CODEGEIST_2026_FINAL.mp4` (2:54, QA ACCEPTED 8 Nov —
see `docs/evidence/VIDEO_QA_REPORT.md`). Captured on dev 8.x.
Shipping candidate: main `4ea97f1` (see
`docs/deployment/PROD_RELEASE_CANDIDATE.md`).
Installed production at matrix time: v2.38.0 (source `113ddc5`).

How to read the "Shipping version" column: HAS = present in the RC
(main `4ea97f1`); the "Installed prod" note says whether judges
installing TODAY (v2.38.0) would see it.

| # | Video claim (film beat) | Feature | Source commit | Shipping version (RC) | Installed prod 2.38.0 | Hosted evidence | Judge test |
|---|---|---|---|---|---|---|---|
| 1 | Evidence Graph, 6 records, Confirmed/Inferred | Evidence Graph | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK clean-site run (JDG-1); HOSTED_ACCEPTANCE_T7 (7 records, AVT) | JUDGE_RERUN: Analyze sample root |
| 2 | Portfolio input, collision verdict COMBINED: NEEDS REVIEW | Portfolio Impact Simulator | pre-`113ddc5` (named reasons #165) | HAS | HAS | EVIDENCE_PACK DEMO 2 prod 2.36.0/2.37.0 (EMERGENT_IMPACT + MIGRATE_ONTO_RETIRED) | JUDGE_RERUN: portfolio interaction |
| 3 | Per-side verdicts | Portfolio per-change detail | pre-`113ddc5` | HAS | HAS | same as #2 | same as #2 |
| 4 | Composer #1, 0 conflicts, assumption stated | Safe Change Composer | #176 (in 2.37.0) | HAS | HAS | EVIDENCE_PACK prod 2.37.0 session (compatibility phase #1) | JUDGE_RERUN: Show the Composer |
| 5 | Decision Firewall BLOCKED traced to AVT-4/5/8 | Decision Firewall | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK (Firewall verdicts); HOSTED_ACCEPTANCE_T7 (MIGRATE FIRST Pass) | JUDGE_RERUN: Review a plan |
| 6 | Release Command Center (AVT-3 INVALIDATED, needs re-check) | Release Command Center | `8b5091f` (#188, dev 6.28.0) — VERIFIED absent from `113ddc5` | HAS | **MISSING** — prod shows Release Safety view only | HOSTED_ACCEPTANCE_T7 covers Mission Control incl. RCC render path on dev 8.1.0 (read-only); dedicated RCC hosted exercise pending (#191) | JUDGE_RERUN: Show Release Safety + project switch (no stale data) |
| 7 | Approve → execute as separate steps | Explicit approvals | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK clean-site run (plan-a0e742f7) | JUDGE_RERUN: Review and approve a plan |
| 8 | Verified execution (1 of 1 read back, comment id) | Verified Jira execution | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK: 6/6 writes verified; clean-site VERIFIED 14:01 | JUDGE_RERUN: Execute + verify Jira read-back |
| 9 | Approved-not-executed plan state | Plan lifecycle states | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK DEMO 3 (Approved · not executed) | JUDGE_RERUN: approval flow |
| 10 | Evidence-changed refusal (AVT-1 DEPENDS_ON AVT-3 added) | Stale-decision refusal | pre-`113ddc5` (#179 polish) | HAS | HAS | EVIDENCE_PACK prod 2.37.0 session (plan-43328562, 0 writes) | JUDGE_RERUN: evidence change + invalidation |
| 11 | Time Machine checkpoint diff | Decision Time Machine | #174 (in 2.37.0) | HAS | HAS | EVIDENCE_PACK prod 2.37.0 session ("Added: ADM-1 depends on ADM-6") | JUDGE_RERUN: Passport + history |
| 12 | Passport refusal (validator refuses transition) | Prevention Passport + workflow validator | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK judge-site validator run (3 Nov) | JUDGE_RERUN: workflow refusal |

## Adjacent (in film context, not dedicated beats)

- Causal Collision Explorer: source `8b5091f` (#188), in RC, MISSING
  from installed prod 2.38.0. The film's collision beats (#2–#3) use the
  portfolio panel (present everywhere); the Explorer is the drill-down.
- Decision Radar: code-present in prod 2.38.0 (production link-created
  event observed 5 Nov); no dedicated film shot — no parity issue.
- MCP/Rovo, Teamwork Graph, Marketplace, customers, ROI: correctly
  ABSENT from the film (VIDEO_QA_REPORT). No parity issue.

## Verdict

- RC (`4ea97f1`) supports every film beat: **12/12 HAS** (row #6
  verified by `git show` file presence + MissionControl wiring on main).
- Installed prod (v2.38.0) supports 11/12: row #6 MISSING.
- **The single parity gap closes when the production RC deploys.**
  Until then, a judge installing from the public link would see the
  Release Safety view where the film shows the Release Command Center.
  This is a P0 release-routing issue, not a product defect: both views
  ship together in the RC (MissionControl renders both, each keyed by
  project).
- No film beat requires re-capture: all footage shows behavior the RC
  contains. Do NOT re-record for parity reasons.
