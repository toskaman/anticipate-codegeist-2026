# ANTICIPATE - source of truth (dated)

Updated: 3 Nov 2026, ~07:40 Paris. Owner of this file: CORE.

| Item | Value |
|---|---|
| Repository | github.com/toskaman/anticipate-codegeist-2026 (public, proprietary source-available license, 50/50 toskaman and Orphee) |
| main | `5e04df1` (PR #35) + this update |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e (unchanged) |
| Development | deployed from feat/core-engine = main 5e04df1 (zod 4), site one-atlas-euza |
| Production | deployed from main 5e04df1 (zod 4), judges' clean site toskaman5962 (loads) |
| Tests (main) | backend 74 (incl. 50-cycle soak), simulation engine 11, contracts 3, frontend 60 unit; CI green |

## Capabilities actually available
| Capability | State | Proof |
|---|---|---|
| Jira read/write with per-action approval and verification | LIVE_FORGE | 6/6 writes on TD; 4/4 on AVT-3 |
| Continuous Decision Safety (evidence drift refusal) | LIVE_FORGE | plan-4ac3c031 refused, plan-85ba308a CHANGED via MCP |
| Workflow validator with decision attestations (schema 3) | LIVE_FORGE | AVT-3 allowed then refused after new link; partial plan refused (PARTIAL) |
| Validator outage policy (admin) | UNIT_TESTED | UI pending EXPERIENCE |
| Assumed-migration guard (R17) and Passport `gate` | UNIT_TESTED; deployed | UI for `gate` pending EXPERIENCE |
| Judge journey (guided demo → Passport) | LIVE_FORGE on dev (MOBL-58) | clean-site run pending a Jira site with software projects |
| Sample data (guided demo), CONFLICT guard | LIVE_FORGE | MP, AVT, MOBL; CONFLICT logged, no duplicates |
| Dependency upgrade + compatibility evidence | LIVE_FORGE | MP-5 via UI and MCP |
| Prevention Passport, historical record after snapshot expiry | UNIT_TESTED (expiry), LIVE_FORGE (live passport + PDF print) | retention tests |
| MCP tools (5, read-only) | LIVE_FORGE | external Claude client on dev |
| Rovo agent | LIVE_FORGE on dev (site has Rovo); production site has no Rovo |
| Teamwork Graph | NOT CONFIGURED; prototype adapter only | docs say Preview + read:graph scopes; no scopes added |

## Known limitations
- The production clean site has only Jira Service Management: the judge demo needs a site with Jira software projects (see docs/submission/INSTALL_LINK.md). Full clean-site judge run: NOT TESTED.
- Plans are private to their creator (shared workspace: design only, docs/design-core/ENTERPRISE_WORKSPACE.md).
- zod 4.6.7 everywhere (high advisory remediated). 5 moderate advisories remain in Forge tooling (breaking @forge/api major needed).
- Cold start to usable app about 8 to 11 s (LIVE_FORGE timings in evidence/experience/v4-ux).
- MOCK_TRANSPORT screenshots are UI evidence only, not production proof.
