# ANTICIPATE - source of truth (dated)

Updated: 3 Nov 2026, ~12:40 Paris. Owner of this file: CORE.

| Item | Value |
|---|---|
| Repository | github.com/toskaman/anticipate-codegeist-2026 (public, proprietary source-available license, 50/50 toskaman and Orphee) |
| Versions, deployed builds, test counts | single source: [RELEASE.md](RELEASE.md) (refreshed 3 Nov, main 0a11792) |
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
| MCP tools (5, read-only) | LIVE_FORGE | external Claude client on dev |
| Rovo agent | LIVE_FORGE on dev (site has Rovo); production site has no Rovo |
| Teamwork Graph | BLOCKED: app not allowlisted | 3 Nov: `read:graph:jira` refused at deploy (restricted scope); `read:graph:issue:jira` deployed on dev (branch exp/teamwork-graph, v5.1.0), but the user consent flow never grants it (the issued code lists only the Jira scopes), so the hosted probe keeps asking for authorization. Atlassian docs: apps must be allowlisted via Atlassian support. Dev rolled back to CORE (v6.0.0, no graph scope); production never changed. Allowlist requested: ECOHELP-180616 (2 Nov 2026); evidence in docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md. Bonus not claimable until enabled |

## Known limitations
- Clean-site judge run: PASS on 3 Nov 2026 (anticipate-judge, Jira Free, production install from the public link; full journey to a Completed Passport; docs/evidence/EVIDENCE_PACK.md). Limited-permission roles cannot be configured on Jira Free (unit tests cover them).
- Plans are private to their creator (shared workspace: design only, docs/design-core/ENTERPRISE_WORKSPACE.md).
- zod 4.6.7 everywhere (high advisory remediated). 5 moderate advisories remain in Forge tooling (breaking @forge/api major needed).
- Cold start to usable app about 8 to 11 s (LIVE_FORGE timings in evidence/experience/v4-ux).
- MOCK_TRANSPORT screenshots are UI evidence only, not production proof.
