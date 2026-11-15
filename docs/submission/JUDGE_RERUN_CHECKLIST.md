# Judge-site clean re-run checklist (shipping build)

Goal: reproduce the full judge journey on a clean site with the shipping production build,
recapture hosted evidence, and close the "judge site stale since 2.35" gap (scorecard:
Judge reproducibility). Owner-gated: needs the `anticipate-judge` account (other owner).

## Setup

- [ ] Production build version noted (Settings → Performance; expected: current `RELEASE.md`
      production row). Judge site must show the shipping version, not 2.35.
- [ ] Clean project JDG (company-managed software): JDG-1 labelled `anticipate-change`,
      in Backlog; validator "ANTICIPATE Decision Firewall" on the transition to "En cours" ("In Progress" in English Jira).
- [ ] Capture environment: 1920×1080, zoom 125%, dark theme, notifications off.

## Journey (DEVPOST_FINAL testing instructions, step by step)

| # | Step | Expected | Observed (fill on the day) |
|---|---|---|---|
| 1 | Install from the public link (`INSTALL_LINK.md`), then Jira → Apps → ANTICIPATE | Installs, app listed in the Apps menu, opens, "Connected · live mode" | |
| 2 | Guided demo → Preview sample data | Preview lists creates, writes nothing | |
| 3 | Confirm sample data | 6 labelled issues + 4 links, re-read from Jira | |
| 4 | Analyze JDG-1 → Evidence Graph | CONFIRMED/INFERRED/UNKNOWN with Jira sources | |
| 5 | Compare options (A/B/C) | BLOCKED / NEEDS_REVIEW / PASS + assumption line | |
| 6 | Portfolio: MIGRATE JDG-1 → JDG-5 + UPGRADE JDG-5 breaking | Each Pass alone, worse together; EMERGENT_IMPACT + named conflict | |
| 7 | Composer on the step-6 pair: alternatives ranked | #1 with 0 conflicts + stated assumption (other pairs can rank a 1-conflict #1; still honest) | |
| 8 | Generate plan → approve ALL actions → execute | Per-action VERIFIED by read-back | |
| 9 | Prevention Passport | "In short", approvals, outcomes, transition status | |
| 10 | Move JDG-1 → refused; real migration → move → accepted | Refused with reason, then allowed | |
| 11 | Release overview + Release Safety | Groups, states, unknowns listed | |
| 12 | Radar: add a link → needsReview → re-check → blocked, 0 writes | Hint in minutes, refusal explained | |
| 13 | Slip: simulate a delay on the sample root (optional: create a fixVersion and assign it for the late-releases part) | Moved dates with paths; late releases named if a version exists | |

## Capture list (hosted gallery)

Graph, comparison, portfolio collision, composer ranking, approval dialog, VERIFIED
execution, Passport short answer, validator refusal banner, validator acceptance,
Release Safety, Radar hint, Time Machine invalidation. Name files
`hosted-<date>/<scene>-JDG-prod-<version>.jpg`.

## Close-out (same day)

Last run: 15 Nov 2026 on production 4.7.0 (EVIDENCE_PACK "Judge re-run on production 4.7.0"; 13/13 steps; findings fixed in production 4.8.0 and re-checked on the judge site the same night). Previous: 12 Nov 2026 on production 4.6.0 — all items below done (EVIDENCE_PACK "Judge re-run on the shipping build"; captures in `docs/evidence/hosted-2026-11-12/`).


- [ ] First-open timings measured (warm / backend-cold) → `RELEASE.md` latency row (Q10).
- [ ] Test counts recounted on the shipping main (`RELEASE.md` method) → freeze counts.
- [ ] EVIDENCE_PACK rows added with the legend labels; "proofs still missing" updated.
- [ ] STATUS.md judge row + scorecard Reproducibility row updated (evidence-gated).
- [ ] JDG reset: JDG-1 back to Backlog, consumer links recreated via Preview sample data.
- [ ] Screenshots + build version filed; `VIDEO_PUBLISHED.md` cross-linked after recording.
