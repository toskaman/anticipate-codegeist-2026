# Perfect 10 scorecard (internal, evidence-backed)

Last verified: **4 Nov 2026, ~23:00 Paris** on `main` **23b5328** (muse). Development v6.20.0, production v2.36.0.
Scores are **internal planning estimates**, not predictions of the judges. A score only moves with evidence; anything without hosted proof is `NOT_VERIFIED`. Sources of truth: [RELEASE.md](../RELEASE.md) (versions, test counts), [STATUS.md](../STATUS.md) (capability states), [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md).

| Dimension | Target | Provisional | NOT_VERIFIED items | Top gap (severity) | Next task |
|---|---|---|---|---|---|
| Technology | 10 | 8 | Radar issue-deleted event; slip/portfolio MCP tools in an external client | Radar link events, slip, portfolio, evidence-changed refusal and verified execution observed LIVE_FORGE_DEV (4 Nov, EVIDENCE_PACK); MCP tools not exercised from an external client (HIGH) | external MCP client run on dev |
| Design | 10 | 8 | native screen reader | Portfolio panel and Radar panel built and used live on dev (4 Nov); conflict reasons now named (#165). Playwright runs Chromium, Firefox and WebKit in CI since #168 (local browsers, not hosted Jira evidence); no native screen-reader run (MEDIUM) | native screen-reader pass (NVDA/VoiceOver) |
| Impact | 10 | 6 | Value study not run with real users | Only synthetic benchmark + hosted journeys; no measured comparison vs manual Jira inspection (HIGH) | run `VALUE_STUDY_PROTOCOL.md` on the judge dataset (timed, self-run, labelled as such) |
| Innovation | 10 | 8 | Collision demo on the judge site | DEMO 2 reproduced live on dev and on production (toskaman5962, 5 Nov); DEMO 3 live on dev; not yet run on anticipate-judge (other account) (LOW) | owner runs the guided demo on anticipate-judge |
| Presentation | 10 | 4 | Video does not exist | Mandatory video (K1) not recorded (owner, deferred by decision); Devpost form not filled (K2) | owner, near submission; script ready (`docs/submission/VIDEO_SCRIPT.md`) |
| Security | 10 | 8 | Two-account hosted acceptance | Shared-decision bypass **fixed** (#144) and fault-tolerant (#145) but only unit-tested; feature correctly release-locked (MEDIUM) | #131 two-account run |
| Performance | 10 | 8 | compare/execute under load; large graphs hosted | 10-parallel bursts on dev: listProjects 30/30 (p95 1.9 s), getGraphSnapshot 20/20 (p95 2.6 s); compare/execute and large hosted graphs not load-tested (MEDIUM) | burst on compareScenarios; larger demo graph |
| Commercial readiness | 10 | 5 | Pricing / buyer journey unvalidated | Pricing hypotheses, Forge unit economics and Marketplace checklist now written (COMMERCIAL_STRATEGY.md, cited platform facts) but **no interviews or pilot yet**, so the score does not move (HIGH) | 5 interviews per persona + Van Westendorp, then decide payment model |
| Judge reproducibility | 10 | 8 | Clean-site rerun on production 2.36.0 | Production 2.36.0 (4 Nov) includes #144–#165; smoke on toskaman5962 only; anticipate-judge belongs to another account (MEDIUM) | clean-site rerun by the owner |
| Documentation / compliance | 10 | 8 | — | RELEASE/STATUS/EVIDENCE_PACK re-synced 4 Nov after 2.36.0; MCP tool count guarded by a test (#163). Devpost text must be re-read against the final build (LOW) | re-sync at release freeze |

## Blockers outside the agents' control
- ~~Browser session expired~~ resolved 4 Nov: the owner session on the dev site works (hosted checks done).
- **Two test accounts** with access to one project: needed for #131.
- **Production deploy**: done by muse through the owner-approved bridge (`muse-cmd deploy-prod`), release gates checked; see RELEASE.md.
- **Teamwork Graph**: allowlisting pending (ECOHELP-180616). Optional.
- **Video and Devpost submission**: owner, deferred to near the deadline (22 Dec 2026, 21:00 Paris).

## Scoring rules
No score rises because a PR merged or unit tests passed. A failed hosted test lowers the score until fixed. Criteria are not redefined to raise a score.
