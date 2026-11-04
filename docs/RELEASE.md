# Release record (source of truth for the jury build)

Validated: 3 Nov 2026, 13:40 Paris (CORE). Versions and test counts refreshed 4 Nov 2026, ~19:30 Paris (muse, from runner output on a clean checkout of main 3668327). **This file is the single source for versions and test counts**; other documents link here instead of repeating them.

| Item | Value |
|---|---|
| main | 3668327 (adds #156 first-run copy, #157 shared-decisions acceptance panel (dev only) + refused-execution display, #158 radar sticky-error fix, #159 inert policy-as-code preview engine) |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e |
| Development | v6.19.0 on one-atlas-euza, 4 Nov 2026 ~18:05 UTC (main 3668327) |
| Production | deployed by the owner 4 Nov 2026 ~15:40 UTC from main ea3ee7c (includes #144–#151); verified on toskaman5962 |
| Scopes | read:jira-work, write:jira-work, read:jira-user, storage:app (no graph scopes) |
| Feature flags | `sharedDecisions`: release-locked (`SHARED_DECISIONS_RELEASED = false`, enabling refused even for site admins) until hosted two-account acceptance; validator outage policy per site (default Allow) |
| Capabilities | Jira read/write AVAILABLE; workflow validator AVAILABLE; Rovo agent AVAILABLE where Rovo exists; Rovo MCP PERMISSION_REQUIRED (admin toggle); Teamwork Graph NOT_CONFIGURED (allowlist ECOHELP-180616); Confluence NOT_CONFIGURED |
| Tests (main 3668327) | backend **254** (27 files), simulation-core **75** (5 files), contracts **8**, frontend unit **142** (31 files), Playwright **139** (27 spec files); CI green (core, frontend, e2e) on #157, #158, #159 |
| How tests are counted | Runtime totals reported by the runners, not a count of `it(` in the source (some tests are generated in loops, e.g. `test/validator-policy.test.ts`). Commands: `npm test` at the root (backend), in `packages/simulation-core` and `packages/contracts`, and in `static/hello-world` (vitest "Tests" line); `npx playwright test --list` in `static/hello-world` ("Total" line). |
| Hosted evidence | docs/evidence/EVIDENCE_PACK.md (2, 3 and 4 Nov) |
| Known limitations | clean-site judge run PASS (3 Nov, production, Jira Free; limited roles not configurable on Free); plans private to creator; first open ~2.6 s warm, ~3.9 s backend-cold, up to ~9.3 s right after a deploy (cold CDN), see EVIDENCE_PACK; 5 moderate advisories in Forge tooling |
| Regressions | none known |
