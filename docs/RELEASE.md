# Release record (source of truth for the jury build)

Validated: 3 Nov 2026, 13:40 Paris (CORE). Main/deploy-source rows re-checked 5 Nov 2026 ~03:50 Paris (muse). Versions and test counts refreshed 4 Nov 2026, ~19:30 Paris (muse, from runner output on a clean checkout of main 3668327). **This file is the single source for versions and test counts**; other documents link here instead of repeating them.

| Item | Value |
|---|---|
| GitHub main (current) | 4fa2cc4 (5 Nov 2026, after #176). #173 Release Safety, #174 Decision Time Machine, #176 Safe Change Composer are code changes; #172/#175 docs only |
| Source of development deploy | main 4fa2cc4 → **v6.23.0** (5 Nov 2026, via bridge `deploy-dev`). Earlier today: 6.21.0 (after #173), 6.22.0 (after #175) |
| Source of production deploy | main after #165 → v2.36.0. Production does **not** contain #173/#174/#176 (a merge on main is not a deployment) |
| main at test-count refresh | 3668327 (adds #156 first-run copy, #157 shared-decisions acceptance panel (dev only) + refused-execution display, #158 radar sticky-error fix, #159 inert policy-as-code preview engine) |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e |
| Development | v6.23.0 on one-atlas-euza, 5 Nov 2026 (main 4fa2cc4). Hosted check of the three new features NOT done yet (dev app not reachable from the Apps sidebar; admin page shows it blocked in some projects) |
| Production | **v2.36.0** deployed 4 Nov 2026 ~20:40 UTC from main after #165 (portfolio conflict reasons show change names; manifest unchanged); smoke on toskaman5962: loads "Connected · live mode". Previous: v2.35.0 deployed 4 Nov 2026 ~19:55 UTC from main 030e576 (= 3668327 + docs #160) via the bridge (Forge CLI session of the app owner); minor version, manifest unchanged since ea3ee7c, so both installs (toskaman5962, anticipate-judge) upgrade without re-consent. Smoke on toskaman5962 (owner, LIVE_FORGE_PRODUCTION): app loads "Connected · live mode", Settings shows no shared-decisions acceptance panel (release lock holds). anticipate-judge not re-checked after this deploy (owned by another account). Rollback reference: previous production 2.32.0+ from ea3ee7c |
| Scopes | read:jira-work, write:jira-work, read:jira-user, storage:app (no graph scopes) |
| Feature flags | `sharedDecisions`: release-locked (`SHARED_DECISIONS_RELEASED = false`, enabling refused even for site admins) until hosted two-account acceptance; validator outage policy per site (default Allow) |
| Capabilities | Jira read/write AVAILABLE; workflow validator AVAILABLE; Rovo agent AVAILABLE where Rovo exists; Rovo MCP PERMISSION_REQUIRED (admin toggle); Teamwork Graph NOT_CONFIGURED (allowlist ECOHELP-180616); Confluence NOT_CONFIGURED |
| Tests (main after #163 + DEMO 2) | backend **264** (29 files), simulation-core **75** (5 files), contracts **8**, frontend unit **142** (31 files), Playwright **139** (27 spec files); CI green (core, frontend, e2e) on #157, #158, #159 |
| Tests (main 4fa2cc4 + this branch, 5 Nov, cloud runner) | backend **295** (32 files), simulation-core **75**, contracts **8**, frontend unit **151**, Playwright **182** listed (all browser projects). Per PR: #173 +12 backend / +4 frontend unit / +3 Playwright; #174 +6 / +2; #176 +8 backend / +2 frontend (#176 also moved portfolio snapshot validation into a shared helper); release overview (this branch) +3 / +1 |
| How tests are counted | Runtime totals reported by the runners, not a count of `it(` in the source (some tests are generated in loops, e.g. `test/validator-policy.test.ts`). Commands: `npm test` at the root (backend), in `packages/simulation-core` and `packages/contracts`, and in `static/hello-world` (vitest "Tests" line); `npx playwright test --list` in `static/hello-world` ("Total" line). |
| Hosted evidence | docs/evidence/EVIDENCE_PACK.md (2, 3 and 4 Nov) |
| Known limitations | clean-site judge run PASS (3 Nov, production, Jira Free; limited roles not configurable on Free); plans private to creator; first open ~2.6 s warm, ~3.9 s backend-cold, up to ~9.3 s right after a deploy (cold CDN), see EVIDENCE_PACK; 5 moderate advisories in Forge tooling |
| Regressions | none known |
