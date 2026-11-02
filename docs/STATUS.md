# ANTICIPATE - source of truth (dated)

Updated: 3 Nov 2026, ~00:30 Paris. Owner of this file: CORE.

| Item | Value |
|---|---|
| Repository | github.com/toskaman/anticipate-codegeist-2026 (public, proprietary source-available license, 50/50 toskaman and Orphee) |
| main | `c813cd5` (PR #31) |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e (unchanged) |
| Development | deployed from main c813cd5, site one-atlas-euza |
| Production | deployed from main c813cd5, judges' clean site toskaman5962 |
| Tests (main) | backend 72, simulation engine 11, contracts 3, frontend 60 unit; CI green |

## Capabilities actually available
| Capability | State | Proof |
|---|---|---|
| Jira read/write with per-action approval and verification | LIVE_FORGE | 6/6 writes on TD; 4/4 on AVT-3 |
| Continuous Decision Safety (evidence drift refusal) | LIVE_FORGE | plan-4ac3c031 refused, plan-85ba308a CHANGED via MCP |
| Workflow validator with decision attestations (schema 3) | LIVE_FORGE | AVT-3 allowed then refused after new link; partial plan refused (PARTIAL) |
| Validator outage policy (admin) | UNIT_TESTED | UI pending EXPERIENCE |
| Sample data (guided demo), CONFLICT guard | LIVE_FORGE | MP, AVT, MOBL; CONFLICT logged, no duplicates |
| Dependency upgrade + compatibility evidence | LIVE_FORGE | MP-5 via UI and MCP |
| Prevention Passport, historical record after snapshot expiry | UNIT_TESTED (expiry), LIVE_FORGE (live passport + PDF print) | retention tests |
| MCP tools (5, read-only) | LIVE_FORGE | external Claude client on dev |
| Rovo agent | LIVE_FORGE on dev (site has Rovo); production site has no Rovo |
| Teamwork Graph | NOT CONFIGURED; prototype adapter only | docs say Preview + read:graph scopes; no scopes added |

## Known limitations
- The production clean site has only Jira Service Management: the judge demo needs a site with Jira software projects (see docs/submission/INSTALL_LINK.md). Full clean-site judge run: NOT TESTED.
- Plans are private to their creator (shared workspace: design only, docs/design-core/ENTERPRISE_WORKSPACE.md).
- zod 3 advisory mitigated by a payload bound; zod 4 migration not done.
- Cold start to usable app about 8 to 11 s (LIVE_FORGE timings in evidence/experience/v4-ux).
- MOCK_TRANSPORT screenshots are UI evidence only, not production proof.
