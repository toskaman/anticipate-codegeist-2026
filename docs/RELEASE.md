# Release record (source of truth for the jury build)

Validated: 3 Nov 2026, 13:40 Paris (CORE). Versions and test counts refreshed 3 Nov 2026, ~21:20 Paris (orpheane, ORP-17; previously ORP-11). **This file is the single source for versions and test counts**; other documents link here instead of repeating them.

| Item | Value |
|---|---|
| main | f9ce7a5 (PRs #84 K5, #86 K6, #94 K7, #81–#110) |
| Forge app id | 39a28f48-c891-4d86-a3cf-c14409cbd29e |
| Development | v6.5.0 on one-atlas-euza, deployed 3 Nov 2026 ~22:00 UTC from main 8ef8239 (K5–K8 included; local gate before deploy: backend 142/142, forge lint clean) |
| Production | v2.30.0 from main d995021 (memoryMB 1024, slip simulation, ORP-6/7), installs from the public link; recorded in EVIDENCE_PACK "Production 2.30.0" |
| Scopes | read:jira-work, write:jira-work, read:jira-user, storage:app (no graph scopes) |
| Feature flags | none; validator outage policy per site (default Allow) |
| Capabilities | Jira read/write AVAILABLE; workflow validator AVAILABLE; Rovo agent AVAILABLE where Rovo exists; Rovo MCP PERMISSION_REQUIRED (admin toggle); Teamwork Graph NOT_CONFIGURED (allowlist ECOHELP-180616); Confluence NOT_CONFIGURED |
| Tests (main f9ce7a5) | backend **142** (22 files), simulation-core **16**, contracts **4**, frontend unit **122** (23 files), Playwright **106** (22 spec files); CI green (core, frontend, e2e) |
| How tests are counted | Runtime totals reported by the runners, not a count of `it(` in the source (some tests are generated in loops, e.g. `test/validator-policy.test.ts`). Commands: `npm test` at the root (backend), in `packages/simulation-core` and `packages/contracts`, and in `static/hello-world` (vitest "Tests" line); `npx playwright test --list` in `static/hello-world` ("Total" line). |
| Hosted evidence | docs/evidence/EVIDENCE_PACK.md (2 and 3 Nov) |
| Known limitations | clean-site judge run PASS (3 Nov, production, Jira Free; limited roles not configurable on Free); plans private to creator; first open ~2.6 s warm, ~3.9 s backend-cold, up to ~9.3 s right after a deploy (cold CDN), see EVIDENCE_PACK; 5 moderate advisories in Forge tooling |
| Regressions | none known |
