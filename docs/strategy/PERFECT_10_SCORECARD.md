# Perfect 10 scorecard (internal, evidence-backed)

Last verified: **8 Nov 2026** on `main` **5610ca7** (post #210; TITAN-9: MCP adversarial tests + MCP docs/D14 + TWG Preview fix). T8 hosted extension (RCC + portfolio DEMO 2 on dev 8.1.0, HOSTED_ACCEPTANCE_T8) added without score moves. Development 8.1.0 (RC code, owner-deployed 7 Nov 21:34:50 CET), production v2.38.0 installed with an uninstalled major 3 pending a shipping decision; prod shipping RC validated and re-pinned 4ea97f1 -> 5610ca7 (PROD_RELEASE_CANDIDATE.md) and film parity mapped 12/12 on the RC, 11/12 on installed prod (VIDEO_SHIPPING_PARITY.md). Fact refresh only: no score moves without new evidence (see scoring rules).
Scores are **internal planning estimates**, not predictions of the judges. A score only moves with evidence; anything without hosted proof is `NOT_VERIFIED`. Sources of truth: [RELEASE.md](../RELEASE.md) (versions, test counts), [STATUS.md](../STATUS.md) (capability states), [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md).

| Dimension | Target | Provisional | NOT_VERIFIED items | Top gap (severity) | Next task |
|---|---|---|---|---|---|
| Technology | 10 | 8 | slip/portfolio MCP tools in an external client; Radar issue-deleted event | 5/7 MCP tools verified from an external client; slip + portfolio pending (HIGH); dev 8.1.0 carries all 7 tools + #198 hardening, 6/6 read-only hosted acceptance green 8 Nov (HOSTED_ACCEPTANCE_T7); Playwright 190/190 executed locally 8 Nov + CI audit gate (#205) — local evidence only, no score move; DEMO 2 re-verified LIVE_FORGE_DEV on dev 8.1.0 8 Nov (HOSTED_ACCEPTANCE_T8) | external MCP client run on dev (#190) |
| Design | 10 | 8 | native screen reader; Command Center/Explorer hosted exercise | A11y specs 12/12 re-green 8 Nov (local chromium); no native screen-reader run (MEDIUM); RCC exercised LIVE_FORGE_DEV 8 Nov (HOSTED_ACCEPTANCE_T8), Explorer drill-down still hosted-pending (#191) | native screen-reader pass (NVDA, human) |
| Impact | 10 | 6 | Self-timed baseline recorded 8 Nov, still no real users | Synthetic + hosted + SELF-RUN #1 (7 Jira page loads vs 3 app actions, CONTAMINATED n=1, illustrative timings — VALUE_BASELINE_SELRUN1.md); no measured comparison vs manual Jira by consenting users (HIGH) | recruit consenting users per `VALUE_STUDY_PROTOCOL.md`; self-run #2 counterbalanced is preparation, not human evidence |
| Innovation | 10 | 8 | Collision demo on the judge site | DEMO 2 live on dev and production; not yet run on anticipate-judge (other account) (LOW) | owner runs the guided demo on anticipate-judge |
| Presentation | 10 | 6 (was 4) | Public video URL; Devpost form | Final cut rendered + QA ACCEPTED 8 Nov (VIDEO_QA_REPORT): 2:54, genuine footage, timed subtitles, clean licenses — but NOT published and Devpost form not filled (HIGH) | owner: voice spot-check, co-owner approval, public upload, form fill (#189) |
| Security | 10 | 8 | Two-account hosted acceptance | #198 hardening (throttle hashing, marker corroboration, BLOCKED literal, Rovo guards, policy cache) tested + deployed on dev 8.1.0; shared-decision bypass fixed but only unit-tested, feature correctly release-locked (MEDIUM) | #131 two-account run |
| Performance | 10 | 8 | compare/execute under load; large graphs hosted | 10-parallel bursts green (listProjects p95 1.9 s, getGraphSnapshot p95 2.6 s); dev 8 Nov warm sample 189/1675 ms; compare/execute and large hosted graphs not load-tested (MEDIUM) | burst on compareScenarios; larger demo graph |
| Commercial readiness | 10 | 5 | Pricing / buyer journey unvalidated | README buyer section + install-link HEAD 200 added, but **no interviews or pilot yet**, so the score does not move (HIGH) | 5 interviews per persona + Van Westendorp, then decide payment model |
| Judge reproducibility | 10 | 8 | Clean-site rerun on the shipping build | anticipate-judge install on major 2 (Outdated app); production major 3 deployed-never-installed; shipping RC validated with deploy/smoke/rollback procedure (PROD_RELEASE_CANDIDATE.md) but NOT deployed — owner decision still pending (MEDIUM); parity gap RCC-vs-prod documented (parity matrix row #6) | owner production deploy + clean-site rerun (#191) |
| Documentation / compliance | 10 | 9 (was 8) | Devpost final re-read against shipping build | Re-synced 8 Nov through #206 + T8 hosted extension: video QA, hosted acceptances + screenshots, RC deploy record, prod RC + parity matrix, jury README with poster/badges, recount 326/75/12/201/190; Devpost text + video URL still pending (LOW) | re-sync at release freeze |

## Blockers outside the agents' control
- **Two test accounts** with access to one project: needed for #131.
- **Production release decision + deploy**: owner-approved per repo convention; major 3 deployed-never-installed must be resolved (promote or supersede); see RELEASE.md. Never Marketplace-submit this app ID (kills the sharing install link).
- **Teamwork Graph**: allowlisting pending (ECOHELP-180616). Optional.
- **Video publication and Devpost submission**: owner (#189), deadline 22 Dec 2026, 21:00 Paris.
- **MCP 7/7 session + judge re-run**: owners (#190, #191); dev 8.1.0 live with all 7 tools.

## Scoring rules
No score rises because a PR merged or unit tests passed. A failed hosted test lowers the score until fixed. Criteria are not redefined to raise a score.
