# TITAN killer-feature scoring (12 Nov 2026, internal)

Method: 5 candidates (3 shipped, 2 unshipped) scored 1–10 on the 10
TITAN dimensions. Scores are internal judgment, not jury data.

| # | Candidate | pain | improve | time | demo | origin | tech | rubric | feas | reliab | evid | Total |
|---|-----------|-----:|--------:|-----:|-----:|-------:|-----:|-------:|-----:|-------:|-----:|------:|
| 1 | Collision-pair completion (SHIPPED 4.6.0) | 9 | 9 | 8 | 10 | 8 | 7 | 9 | 10 | 9 | 9 | 88 |
| 2 | Decision Firewall validator (SHIPPED) | 9 | 9 | 7 | 9 | 8 | 8 | 9 | 10 | 9 | 9 | 87 |
| 3 | Verified execution w/ read-back (SHIPPED) | 8 | 8 | 7 | 8 | 7 | 7 | 9 | 10 | 10 | 9 | 83 |
| 4 | Shared decision workspace (unshipped, flag-gated) | 9 | 8 | 6 | 6 | 7 | 7 | 7 | 3 | 4 | 3 | 60 |
| 5 | NL plan builder via Rovo (unshipped) | 7 | 7 | 8 | 8 | 6 | 5 | 7 | 4 | 4 | 3 | 59 |

## Verdict: no new build. Double down on #1.

- The shipped trio (#1–#3) wins on feasibility, reliability, and
  evidence because it is deployed (prod 4.6.0), tested, filmed, and
  documented. #1 is already the film's signature moment and the
  glanceable-comparison UI: it satisfies "killer feature" without
  further work.
- #4 (shared workspace) has the highest raw pain score but fails
  feasibility + reliability + evidence under freeze: it needs a
  two-account hosted proof (D3), a deploy, and re-evidence — all
  owner-gated with 40 days left. Correctly deferred.
- #5 (NL builder) scores well on demo but weak on technical
  differentiation (thin Rovo wrapper), reliability (probabilistic
  drafting over deterministic verdicts), and brand (violates the
  deterministic-governance identity). Correctly rejected.

Per TITAN's own rule ("if the six questions cannot be answered
convincingly, reconsider the feature"), #4 and #5 do not clear the
bar. The winning move is presentation, not construction: lead every
judge touchpoint with the collision moment (film cold open, README,
Devpost, gallery GIF).
