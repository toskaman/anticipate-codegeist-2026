# Perfect 10 scorecard (internal, evidence-backed)

Last verified: **6 Nov 2026** on `main` **b8d0c8c** (post #194; TITAN cycle). Development v6.28.0, production v2.38.0. Fact refresh only: no score moves without new evidence (see scoring rules).
Scores are **internal planning estimates**, not predictions of the judges. A score only moves with evidence; anything without hosted proof is `NOT_VERIFIED`. Sources of truth: [RELEASE.md](../RELEASE.md) (versions, test counts), [STATUS.md](../STATUS.md) (capability states), [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md).

| Dimension | Target | Provisional | NOT_VERIFIED items | Top gap (severity) | Next task |
|---|---|---|---|---|---|
| Technology | 10 | 8 | Radar issue-deleted event; slip/portfolio MCP tools in an external client | Radar link events, slip, portfolio, evidence-changed refusal and verified execution observed LIVE_FORGE_DEV (4 Nov); Release Safety, overview, Composer, Time Machine + first Radar prod event observed LIVE_FORGE_PRODUCTION 5 Nov on 2.37.0 (EVIDENCE_PACK). 5/7 MCP tools verified from an external client; slip + portfolio pending (HIGH); dev v6.28.0 carries all 7 tools for the session (#190) | external MCP client run on dev |
| Design | 10 | 8 | native screen reader; Command Center/Explorer hosted exercise | Portfolio panel and Radar panel built and used live on dev (4 Nov); conflict reasons now named (#165). Playwright runs Chromium, Firefox and WebKit in CI since #168 (local browsers, not hosted Jira evidence); new Explorer/Command Center views UNIT_TESTED + mock-e2e axe-clean, hosted pending (#191); no native screen-reader run (MEDIUM) | native screen-reader pass (NVDA/VoiceOver) |
| Impact | 10 | 6 | Value study not run with real users | Only synthetic benchmark + hosted journeys; no measured comparison vs manual Jira inspection (HIGH) | run `VALUE_STUDY_PROTOCOL.md` on the judge dataset (timed, self-run, labelled as such) |
| Innovation | 10 | 8 | Collision demo on the judge site | DEMO 2 reproduced live on dev and on production (toskaman5962, 5 Nov, 2.37.0 session); DEMO 3 live on dev; not yet run on anticipate-judge (other account) (LOW) | owner runs the guided demo on anticipate-judge |
| Presentation | 10 | 4 | Video does not exist | Mandatory video (K1) not recorded (owner); Devpost form not filled (K2) | owner; word-for-word script v3 + checklist ready (`docs/submission/VIDEO_SCRIPT.md`, #189) |
| Security | 10 | 8 | Two-account hosted acceptance | Shared-decision bypass **fixed** (#144) and fault-tolerant (#145) but only unit-tested; feature correctly release-locked (MEDIUM) | #131 two-account run |
| Performance | 10 | 8 | compare/execute under load; large graphs hosted | 10-parallel bursts on dev: listProjects 30/30 (p95 1.9 s), getGraphSnapshot 20/20 (p95 2.6 s); compare/execute and large hosted graphs not load-tested (MEDIUM) | burst on compareScenarios; larger demo graph |
| Commercial readiness | 10 | 5 | Pricing / buyer journey unvalidated | Pricing hypotheses, Forge unit economics and Marketplace checklist now written (COMMERCIAL_STRATEGY.md, cited platform facts) but **no interviews or pilot yet**, so the score does not move (HIGH) | 5 interviews per persona + Van Westendorp, then decide payment model |
| Judge reproducibility | 10 | 8 | Clean-site rerun on the shipping build | Production 2.38.0 (5 Nov, #179); smoke on toskaman5962 only; anticipate-judge install current (major 2, verified live 6 Nov) but behavior not re-checked since 2.35 and belongs to another account (MEDIUM) | clean-site rerun by the owner (#191) |
| Documentation / compliance | 10 | 8 | — | Re-synced 6 Nov through #194: gauntlet, defensibility, quota facts, recount 306/75/12/175/186, jury kit (script v3, runbooks, checklists); MCP tool count guarded by a test (#163, CRLF fix #187). Devpost text must be re-read against the final build (LOW) | re-sync at release freeze |

## Blockers outside the agents' control
- ~~Browser session expired~~ resolved 4 Nov: the owner session on the dev site works (hosted checks done).
- **Two test accounts** with access to one project: needed for #131.
- **Production deploy**: done by muse through the owner-approved bridge (`muse-cmd deploy-prod`), release gates checked; see RELEASE.md.
- **Teamwork Graph**: allowlisting pending (ECOHELP-180616). Optional.
- **Video and Devpost submission**: owner (#189), deadline 22 Dec 2026, 21:00 Paris.
- **MCP 7/7 session + judge re-run**: owners (#190, #191); dev v6.28.0 live with all 7 tools.

## Scoring rules
No score rises because a PR merged or unit tests passed. A failed hosted test lowers the score until fixed. Criteria are not redefined to raise a score.
