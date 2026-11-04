# ANTICIPATE - source of truth (dated)

Updated: 4 Nov 2026, ~02:00 Paris (capabilities table extended by muse, wave 3). Owner of this file: CORE.

| Item | Value |
|---|---|
| Repository | github.com/toskaman/anticipate-codegeist-2026 (public, proprietary source-available license, 50/50 toskaman and Orphee) |
| Versions, deployed builds, test counts | single source: [RELEASE.md](RELEASE.md) (refreshed 3 Nov, main f9ce7a5) |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e (unchanged) |

## Capabilities actually available
| Capability | State | Proof |
|---|---|---|
| Jira read/write with per-action approval and verification | LIVE_FORGE | 6/6 writes on TD; 4/4 on AVT-3 |
| Continuous Decision Safety (evidence drift refusal) | LIVE_FORGE | plan-4ac3c031 refused, plan-85ba308a CHANGED via MCP |
| Workflow validator with decision attestations (schema 3) | LIVE_FORGE | AVT-3 allowed then refused after new link; partial plan refused (PARTIAL) |
| Validator outage policy (admin) | LIVE_FORGE on dev | admin ALLOW to BLOCK to ALLOW persisted (12:03); non-admin read-only, no control (EXPERIENCE capture) |
| Assumed-migration guard (R17), legitimate OPEN and Passport `gate` | LIVE_FORGE on dev and in production (judge site JDG: CLOSED then OPEN after real migration) | MOBL-58 Migrate first: Jira transition CLOSED with reason |
| Validator: unreadable issue (403/404) follows outage policy (R18) | UNIT_TESTED; hosted attempt | 6 tests; on AVT a reporter-only security level does not hide issues from the app, so 403 cannot be produced on this site (see ENGINEERING_REPORT R18) |
| Judge journey (guided demo → Passport) | LIVE_FORGE in production on a clean site | anticipate-judge JDG-1, 3 Nov 14:01 |
| Sample data (guided demo), CONFLICT guard | LIVE_FORGE | MP, AVT, MOBL; CONFLICT logged, no duplicates |
| Dependency upgrade + compatibility evidence | LIVE_FORGE | MP-5 via UI and MCP |
| Prevention Passport, historical record after snapshot expiry | UNIT_TESTED (expiry), LIVE_FORGE (live passport + PDF print) | retention tests |
| MCP tools (6 hosted, read-only; 7th `anticipate-simulate-portfolio` deployed on dev 6.8.0, not yet exercised hosted) | LIVE_FORGE for the original tools | external Claude client on dev |
| Rovo agent | LIVE_FORGE on dev (site has Rovo); production site has no Rovo |
| What-if slip simulation | LIVE_FORGE (judge site, production) | EVIDENCE_PACK "Slip panel on the judge site" |
| Portfolio Impact Simulator (up to 10 changes) | UNIT_TESTED; UI op + Rovo/MCP deployed on dev, not hosted-tested; no UI yet (ORP-32) | #129, #141; docs/design-core/PORTFOLIO_SIMULATOR.md |
| Shared decision workspace | UNIT_TESTED; ops deployed but OFF (flag `sharedDecisions`); execution gate implemented; needs hosted two-account test | #129, #141, wave 3; docs/design-core/ENTERPRISE_WORKSPACE.md |
| Decision radar slice 1 (issue-link / issue-deleted triggers -> NEEDS_REVIEW attention) | UNIT_TESTED; trigger payload field names unverified hosted | wave 3; docs/design-core/DECISION_RADAR.md |
| Policy-as-code (declarative v1, preview only) | UNIT_TESTED engine only; nothing enforced | wave 3; docs/design-core/POLICY_AS_CODE.md |
| Storage-contract regression suite (Forge KVS key rules, fault injection) | UNIT_TESTED | #129, wave 3; test/fault-injection.test.ts |
| Teamwork Graph | BLOCKED: app not allowlisted | 3 Nov: `read:graph:jira` refused at deploy (restricted scope); `read:graph:issue:jira` deployed on dev (branch exp/teamwork-graph, v5.1.0), but the user consent flow never grants it (the issued code lists only the Jira scopes), so the hosted probe keeps asking for authorization. Atlassian docs: apps must be allowlisted via Atlassian support. Dev rolled back to CORE (v6.0.0, no graph scope); production never changed. Allowlist requested: ECOHELP-180616 (2 Nov 2026); evidence in docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md. Bonus not claimable until enabled |

## Known limitations
- Clean-site judge run: PASS on 3 Nov 2026 (anticipate-judge, Jira Free, production install from the public link; full journey to a Completed Passport; docs/evidence/EVIDENCE_PACK.md). Limited-permission roles cannot be configured on Jira Free (unit tests cover them).
- Plans are private to their creator. Shared-decision operations exist but answer FEATURE_DISABLED until a site admin enables them (kept off until a hosted two-account test passes).
- zod 4.6.7 everywhere (high advisory remediated). 5 moderate advisories remain in Forge tooling (breaking @forge/api major needed).
- Cold start to usable app about 8 to 11 s (LIVE_FORGE timings in evidence/experience/v4-ux).
- MOCK_TRANSPORT screenshots are UI evidence only, not production proof.
