# Video ↔ shipping-build parity matrix (TITAN-8, 8 Nov 2026)

Film: `ANTICIPATE_CODEGEIST_2026_FINAL.mp4` (2:54, QA ACCEPTED 8 Nov —
see `docs/evidence/VIDEO_QA_REPORT.md`). Captured on dev 8.x.
Shipping build: main `5610ca7`, DEPLOYED as production **4.0.0** 8 Nov 2026 13:20:51 UTC (see
`docs/deployment/PROD_RELEASE_CANDIDATE.md`).
Installed production at matrix refresh: 4.0.0 on toskaman5962 (Up-to-date); anticipate-judge still on major 2 pending its site admin's upgrade. New installs receive 4.0.0 (consent page verified 8 Nov: 4 scopes, no graph scopes).

How to read the "Shipping version" column: HAS = present in the shipping build
(main `5610ca7` = production 4.0.0); the "Installed prod" column says whether judges
installing TODAY (4.0.0) see it.

| # | Video claim (film beat) | Feature | Source commit | Shipping version (4.0.0) | Installed prod 4.0.0 | Hosted evidence | Judge test |
|---|---|---|---|---|---|---|---|
| 1 | Evidence Graph, 6 records, Confirmed/Inferred | Evidence Graph | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK clean-site run (JDG-1); HOSTED_ACCEPTANCE_T7 (7 records, AVT) | JUDGE_RERUN: Analyze sample root |
| 2 | Portfolio input, collision verdict COMBINED: NEEDS REVIEW | Portfolio Impact Simulator | pre-`113ddc5` (named reasons #165) | HAS | HAS | EVIDENCE_PACK DEMO 2 prod 2.36.0/2.37.0 (EMERGENT_IMPACT + MIGRATE_ONTO_RETIRED) | JUDGE_RERUN: portfolio interaction |
| 3 | Per-side verdicts | Portfolio per-change detail | pre-`113ddc5` | HAS | HAS | same as #2 | same as #2 |
| 4 | Composer #1, 0 conflicts, assumption stated | Safe Change Composer | #176 (in 2.37.0) | HAS | HAS | EVIDENCE_PACK prod 2.37.0 session (compatibility phase #1) | JUDGE_RERUN: Show the Composer |
| 5 | Decision Firewall BLOCKED traced to AVT-4/5/8 | Decision Firewall | pre-`113ddc5` | HAS | HAS | EVIDENCE_PACK (Firewall verdicts); HOSTED_ACCEPTANCE_T7 (MIGRATE FIRST Pass) | JUDGE_RERUN: Review a plan |
| 6 | Release Command Center (AVT-3 INVALIDATED, needs re-check) | Release Command Center | `8b5091f` (#188) — was VERIFIED absent from old `113ddc5`, ships in 4.0.0 | HAS | HAS (4.0.0; in-app prod render pending owner smoke, #191) | HOSTED_ACCEPTANCE_T7/T8 RCC on dev 8.1.0 (read-only); dedicated RCC hosted exercise pending (#191) | JUDGE_RERUN: Show Release Safety + project switch (no stale data) |
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

## Verdict (refreshed 8 Nov after the 4.0.0 deploy)

- Shipping build (4.0.0 = `5610ca7`) supports every film beat: **12/12 HAS**.
- Installed prod on toskaman5962: **12/12 structural** (same code); in-app render still to be eyeballed by the owner (#191 smoke).
- anticipate-judge (still major 2): 11/12 until its site admin upgrades.
- **The parity gap is closed for every new install.** Judges installing from the public link receive 4.0.0 with the Release Command Center (consent page verified 8 Nov).
- No film beat requires re-capture: all footage shows behavior the RC
  contains. Do NOT re-record for parity reasons.
