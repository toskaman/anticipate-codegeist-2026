# ANTICIPATE - source of truth (dated)

Updated: 4 Nov 2026, ~16:20 Paris. Owner of this file: CORE (muse).

| Item | Value |
|---|---|
| Repository | github.com/toskaman/anticipate-codegeist-2026 (public, proprietary source-available license, 50/50 toskaman and Orphee) |
| Versions, deployed builds, test counts | single source: [RELEASE.md](RELEASE.md) (refreshed 4 Nov, main 4d937b6) |
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
| MCP tools (read-only; see manifest `rovo:mcp` for the current list) | LIVE_FORGE for the original 5; newer tools (slip, portfolio) NOT_VERIFIED in an external client | external Claude client on dev |
| Shared-decision execution gate (server-side) | UNIT_TESTED + deployed dev 6.9.0; feature release-locked | #144: 13 adversarial tests, every refusal asserts zero Jira writes |
| Approval path under storage faults | UNIT_TESTED | #145: fault injection before/after each write |
| Shared Decision Workspace (two-account flow) | BLOCKED (hosted two-account acceptance not run) | #131 |
| Decision Radar (event-driven needs-review hints) | LIVE_FORGE_DEV for link events (4 Nov: real link deleted → needsReview in ≈3.2 s → cleared by checkPlanFreshness); first live event exposed a payload-shape bug, fixed in #150; issue-deleted event and production delivery NOT_VERIFIED; 4 Nov: one historical invalid event kept every later plan DEGRADED, fixed in #158 and verified LIVE_FORGE_DEV (new plan shows Listening) | EVIDENCE_PACK 4 Nov; #146, #150; UI #147 |
| Portfolio Impact Simulator | backend UNIT_TESTED (#141); UI merged (#142); panel reachable on dev (LIVE_FORGE_DEV, 4 Nov, Scenario Lab); DEMO 2 combined run with a real interaction LIVE_FORGE_DEV 4 Nov (EMERGENT_IMPACT + MIGRATE_ONTO_RETIRED, TD-1/TD-5), production NOT_VERIFIED | #64 |
| Policy-as-code preview engine | UNIT_TESTED only (37 tests, #159); inert: nothing calls it, gates nothing | docs/design-core/POLICY_AS_CODE.md |
| What-if slip panel | LIVE_FORGE_DEV 4 Nov: late release (by 9 d), 3 moved due dates with paths, unknowns listed | EVIDENCE_PACK 4 Nov |
| Rovo agent | LIVE_FORGE on dev (site has Rovo); production site has no Rovo |
| Teamwork Graph | BLOCKED: app not allowlisted | 3 Nov: `read:graph:jira` refused at deploy (restricted scope); `read:graph:issue:jira` deployed on dev (branch exp/teamwork-graph, v5.1.0), but the user consent flow never grants it (the issued code lists only the Jira scopes), so the hosted probe keeps asking for authorization. Atlassian docs: apps must be allowlisted via Atlassian support. Dev rolled back to CORE (v6.0.0, no graph scope); production never changed. Allowlist requested: ECOHELP-180616 (2 Nov 2026); evidence in docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md. Bonus not claimable until enabled |

## Known limitations
- Clean-site judge run: PASS on 3 Nov 2026 (anticipate-judge, Jira Free, production install from the public link; full journey to a Completed Passport; docs/evidence/EVIDENCE_PACK.md). Limited-permission roles cannot be configured on Jira Free (unit tests cover them).
- Plans are private to their creator in production. Shared decisions are implemented and enforced at execution, but release-locked until the hosted two-account test passes.
- zod 4.6.7 everywhere (high advisory remediated). 5 moderate advisories remain in Forge tooling (breaking @forge/api major needed).
- First open: ~2.6 s warm, ~3.9 s backend-cold, up to ~9.3 s right after a deploy (cold CDN); see EVIDENCE_PACK (3 Nov, production 2.30.0).
- MOCK_TRANSPORT screenshots are UI evidence only, not production proof.
