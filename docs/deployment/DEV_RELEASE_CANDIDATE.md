# Development release candidate — main d1e6509 (TITAN-6)

Status: VALIDATED, DEPLOYED BY OWNER 2026-11-07 21:34:50 CET (see T7-2 note below). No further deploy action required for the RC code.

> Superseded T6 line (kept for audit): VALIDATED, NOT DEPLOYED. Deployment was OWNER AUTHORIZATION REQUIRED.
(no valid Forge session on this machine; no standing deploy authorization found —
past deploys each had per-deploy owner approval in chat).

## T7-2 recheck (8 Nov 2026, `forge deploy list` + `forge install list`)

- `default` env, major 8, Success, contributor Toska Marley, at
  2026-11-07T20:34:50Z — 9 min after the #202 merge. Previous major-8
  deploy 18:16Z (= 8.0.0 from `bd683e4`); by Forge minor-increment this
  deploy is **8.1.0** (minor string not directly observable via CLI:
  INFERRED-STRONG, all indirect evidence consistent).
- Installed code = RC code: deploy happened after `d1e6509` (21:15 CET)
  and #202 `9004bab` (21:26 CET), which differ by docs only.
- `forge install list`: development/one-atlas-euza major 8 (Latest),
  Up-to-date. Production installs (toskaman5962, anticipate-judge) show
  major 2, "Outdated app" — a production major 3 was deployed 6 Nov but
  never installed anywhere (see T7-8/9 for the production decision; no
  production action taken in T7-2).
- HEAD `9004bab`, no open PRs, no pushes since #202; manifest unchanged
  since `bd683e4` (re-verified). Pinned CLI 14.2.0 notes 15.0.0
  available — kept pinned for release stability.

## Source

- main `d1e6509` (merge #201). Code delta vs deployed dev v8.0.0 (`bd683e4`):
  #198 backend hardening only — 7 src files
  (`src/core/payloads.ts` new, `throttle.ts`, `engine/release.ts`,
  `engine/service.ts`, `forge-adapters.ts`, `rovo.ts`, `validator.ts`).
- No manifest, scope, module, package.json, migration, feature-flag, or
  frontend-src change (`git diff bd683e4 d1e6509` verified).

## Validation evidence (all on trees identical to d1e6509 in code)

| Gate | Result |
|---|---|
| Backend `npm test` | 326/326 (38 files), local main |
| Contracts / simulation-core | 12 / 75, local |
| Frontend vitest / typecheck / lint / build | 201, exit 0, exit 0, exit 0, local |
| Frontend benchmark / licenses | 1/1, inventory exit 0, local |
| Playwright listed | 190 in 31 files (`--list`) |
| Playwright executed, chromium local | 150/150 (2.0m) |
| Playwright executed, cloud CI (chromium+firefox+webkit) | pass, run 42409482377 (e2e 5m29s) |
| CI core / frontend | pass, same run |
| `forge lint` (pinned node 24.22.1, CLI 14.2.0) | No issues found |
| `npm audit --omit=dev --audit-level=high` | 5 moderate, 0 high, exit 0 |
| Rovo 7-handler local probe (temp, deleted) | 7/7, zero Jira writes |
| KVS 240 KiB boundary probe (temp, deleted) | 4/4, warn path confirmed |
| A11y specs (chromium, incl. new display-prefs) | 12/12 within full run |

## Deploy command (owner) — executed 7 Nov 21:34:50 CET, kept for rollback reference

From a clean checkout of main `d1e6509` on the owner PC with a logged-in Forge CLI:

```powershell
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e development
forge install list
```

Then verify: Settings shows the new build version; Apps → ANTICIPATE loads;
run the §6 journey 1 smoke (project → release → change, no stale data).

Expected version: next dev version assigned by Forge (current v8.0.0 from
`bd683e4`). Code-only change: no new consent required.

## Risk: LOW

- No scope/module change → installs keep working, no re-consent.
- No storage migration; KVS data preserved.
- One-time throttle budget reset on first deploy (throttle identities are now
  hashed — note in release notes, already recorded for #198).
- No frontend change → Custom UI bundle behaviour identical to v8.0.0.

## Rollback

```powershell
git worktree add E:\Codegeist2026\.cache\rc-rollback bd683e4
cd E:\Codegeist2026\.cache\rc-rollback\ANTICIPATE
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e development
```

Verify the dev version reverts in `forge install list` + Settings. Throttle
budgets reset again on rollback. Remove the worktree afterwards
(`git worktree remove --force`).

## Freeze rule

Docs-only commits never change test counts. The count pointer below names the
last fully validated sha; re-verify it (one `--list` + CI link) at submission
freeze instead of chasing every docs merge.
