# Release record (source of truth for the jury build)

Validated: 3 Nov 2026, 13:40 Paris (CORE).

| Item | Value |
|---|---|
| main | e24baf4 (PR #39) + PR #40 docs; CI PR #41 |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e |
| Development | v6.0.0 on one-atlas-euza (main + R18; Teamwork Graph scopes removed after the blocked experiment) |
| Production | v2.27.x on toskaman5962 (main e24baf4: PR #37, R18, PR #39) |
| Scopes | read:jira-work, write:jira-work, read:jira-user, storage:app (no graph scopes) |
| Feature flags | none; validator outage policy per site (default Allow) |
| Capabilities | Jira read/write AVAILABLE; workflow validator AVAILABLE; Rovo agent AVAILABLE where Rovo exists; Rovo MCP PERMISSION_REQUIRED (admin toggle); Teamwork Graph NOT_CONFIGURED (allowlist ECOHELP-180616); Confluence NOT_CONFIGURED |
| Tests | backend 80/80, contracts and engine pass, frontend 60 unit, Playwright journeys; CI green |
| Hosted evidence | docs/evidence/EVIDENCE_PACK.md (2 and 3 Nov) |
| Known limitations | clean-site judge run with three user roles not yet run (needs a Jira Software site); plans private to creator; cold start 8 to 11 s; 5 moderate advisories in Forge tooling |
| Regressions | none known |
