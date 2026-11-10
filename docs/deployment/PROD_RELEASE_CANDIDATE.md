# Production shipping release — main b1e4677, deployed 4.3.0 stamped (OMEGA 10 Nov; history: 4.2.0 from 0904034, 4.1.0 unstamped, 4.0.0 from 5610ca7)

Status: VALIDATED, DEPLOYED 10 Nov 2026 11:45:14 UTC as production 4.3.0, stamped (owner-authorized: "go 4.3.0", 10 Nov; Forge session Toska Marley). Previous: 4.2.0 from 0904034 (00:48:15Z); 4.1.0 same source unstamped (00:35:28Z); 4.0.0 from 5610ca7 (8 Nov 13:20:51 UTC).

## Source

- main `b1e4677` (merge #234; docs-only over `ac940a9` = #233 wow: collision pair + hero, frontend-only, no manifest/contract change). Delta `0904034..b1e4677` verified additive (manifest diff EMPTY).
- main `0904034` (merge #231; docs-only over `25685d0`). Replaces the `5610ca7` pin; the `ee5dbe1` candidate (9 Nov) was superseded without deploy.
- main `5610ca7` (merge #210; code tree = `7c3e334`). Re-pinned 8 Nov after the TWG Preview message fix (#210, one user-visible string + lock test); previous pin `4ea97f1` in git history. Intermediate #206/#207/#209 docs + evidence only; #208 test-only.
- Code delta vs installed production v2.38.0 (source `113ddc5`, after #179):
  32 files in `src`, `static/hello-world/src`, `packages`
  (+3173 / −70 lines), spanning #183–#199 plus #208/#210 tests and the TWG honesty string:
  issue-race/explicit analysis identity, project-scoped releases,
  portfolio generation guards, Release Command Center, Causal Collision
  Explorer, Time Machine retention notice, OMEGA P0 backend hardening
  (#198), a11y display prefs (#199), zod lockfile purge + CI audit gate
  (#205, no source change).
- Delta `5610ca7..0904034` (42 files, +1292/−66) is additive only:
  `getBuildInfo` resolver + contract + `BuildInfoPanel` UI (#220/#222),
  Collision-at-a-glance + graph wheel fix (#228), focus-after-execution
  (#229), #225 e2e hardening + copy fallback (#230), docs + CI retry
  (#211/#219/#221/#223/#224/#227/#231). No storage change, no migration,
  `SHARED_DECISIONS_RELEASED = false` on both ends, no existing operation
  altered.
- Docs-only merges #200–#204 included; they change no shipped code.

## Manifest (VERIFIED)

- `git diff 113ddc5 HEAD -- manifest.yml`: EMPTY. The shipping manifest is
  byte-identical to the installed production manifest.
- Fingerprint: `git hash-object manifest.yml` =
  `b474696d2e2fae62eeda491461431223c3636f30` (same on both ends;
  re-verified 10 Nov: `git diff 5610ca7 HEAD -- manifest.yml` EMPTY on main
  `0904034`).
- Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`,
  `storage:app`. No graph scopes, no Teamwork Graph, no shared-decision
  release (`SHARED_DECISIONS_RELEASED = false`), no licensing change.
- Consequence: a production deploy from this source introduces no new
  permission surface. Whether Forge assigns a major or minor version, and
  whether installs re-consent, must be observed at deploy time (see
  "Version trap" below) — not assumed here.

## Validation evidence

All gates executed on the RC tree (main `5610ca7`):

| Gate | Result |
|---|---|
| Backend `npm test` | 333/333 (39 files; 326 +6 MCP adversarial #208 +1 TWG lock #210), local, re-run on RC tree |
| Contracts / simulation-core | 12 / 75, local |
| Frontend vitest / typecheck / lint / build | 201/201, exit 0, exit 0, build ok, local |
| Playwright listed | 190 in 31 files (`--list`) |
| Playwright executed, local (chromium 150 + firefox 20 + webkit 20) | 190/190 (2.2m), exit 0, re-run on RC tree |
| Cloud CI on #205 (run 42433936416) | core pass 1m3s, frontend pass 59s (incl. new audit step), e2e pass 7m41s |
| `forge lint` (CLI 14.2.0) | No issues found |
| `npm audit --omit=dev --audit-level=high` | root 5 moderate / 0 high; frontend 4 moderate / 0 high |
| Demo 2 deterministic verdict pins | PASS (backend suite, incl. named-reason pins) |
| Rovo 7-handler local probe | 7/7, zero Jira writes (T6 record, handlers unchanged since) |
| KVS 240 KiB boundary probe | 4/4, warn path confirmed (T6 record, storage code unchanged since) |

10 Nov gates on main `0904034` (no source change since `25685d0`;
#231 docs only): main CI 42719465493 green (core, frontend, e2e);
counts backend 336 / simulation-core 75 / contracts 13 / frontend 216
/ Playwright 197 listed (see RELEASE.md).

## Version trap (why this deploy needs care)

Production history (see RELEASE.md):

- Installed everywhere: major 2, v2.38.0 (source `113ddc5`). Both
  production installs show "Outdated app".
- 6 Nov ~13:46 UTC: a production major 3 was deployed from an
  UNCOMMITTED Teamwork Graph experiment manifest (6 scopes incl. graph,
  6 actions, no trigger). It was never installed anywhere.
- A new judge install today would most likely receive major 3
  (INFERRED from Forge latest-version semantics — never install-tested
  and must NOT be treated as the shipping build).

The RC deploy from `5610ca7` carries the approved committed manifest,
which differs from the deployed-never-installed major 3. The owner must
observe at deploy time: the version number Forge assigns, whether the
Developer Console offers the new version as the installable latest, and
whether existing installs ask for re-consent. Record all three before
announcing the shipping build.

## Deploy record (8 Nov 2026, 13:20:51 UTC / 14:20:51 CET)

- Source: detached worktree at exactly `5610ca7` (`.cache/prod-rc-5610ca7`, removed after); manifest hash `b474696d...` re-verified in the worktree; `forge lint` clean; CLI 14.2.0 + node 24.22.1.
- First `forge deploy -e production` stopped on MAJOR_VERSION_RULE ("scope modification"): Forge compares against the latest production version, which was the major-3 TWG experiment — returning to the committed 4-scope manifest is a scope change, so Forge assigned a NEW major. Re-ran with `--approve MAJOR_VERSION_RULE` (same authorized deploy, acknowledging the observed assignment).
- Assigned version: **4.0.0**. Production latest is now the RC: the version trap is structurally closed (major 3 superseded, never installed anywhere).
- Installs after deploy: `toskaman5962` upgraded via CLI to major 4, Up-to-date; `anticipate-judge` CLI upgrade FAILED ("Failed to install into Jira", no detail even verbose) — the Forge session lacks rights there. Site-admin action required: Jira Admin → Apps → Manage apps → ANTICIPATE → Update (grants the same 4 scopes already consented on major 2; no new permission surface).
- Install-link routing VERIFIED (CDP capture browser, consent page read, nothing installed): the link offers exactly the 4 RC scopes (no graph scopes) — new judge installs receive 4.0.0. Screenshot: `docs/evidence/hosted-2026-11-08/24-install-consent-4x.png`.
- In-app production smoke NOT_VERIFIED: the capture-browser session is not entitled on `toskaman5962` ("insufficient permissions to load this app"). Owner step: open Apps → ANTICIPATE there and confirm the Release Command Center renders (its presence proves 4.0.0 code; 2.38.0 lacked it), then run JUDGE_RERUN_CHECKLIST.md (#191).

## Deploy record (10 Nov 2026, 00:48:15 UTC / 01:48:15 CET)

- Source: working tree at exactly `0904034` (clean, `git status` empty); manifest diff `5610ca7..HEAD` EMPTY; `forge lint` clean; CLI latest via npx + portable node 24.22.2 (system node 24.14.1 is rejected by the CLI: requires ^22.23.4 || ^24.22.1 || >=26.12.1).
- First deploy 00:35:28Z assigned **4.1.0** but the build vars were missed (unstamped). Stamped `ANTICIPATE_BUILD_COMMIT=090403468e7f4e7ab89cba62a2d9e6f771430386` + `ANTICIPATE_BUILD_AT=2026-11-10T00:46:06.000Z`, re-read both via `forge variables list -e production` to confirm, then redeployed.
- Assigned version: **4.2.0**. Minor on major 4 (no scope change): existing major-4 installs auto-update without re-consent — OBSERVED via `forge install list` (toskaman5962 production 4 Up-to-date).
- `anticipate-judge` still production 2 Outdated: same site-admin upgrade click as above (Jira Admin → Apps → Manage apps → ANTICIPATE → Update).
- New installs receive 4.2.0 (same 4 scopes; consent-page re-read not repeated — manifest byte-identical to the verified 4.0.0).
- In-app production smoke NOT_VERIFIED (no entitled browser session in this run): owner step unchanged — open Apps → ANTICIPATE on toskaman5962, confirm Settings shows Commit 0904034 + Built 10 Nov 00:46 UTC and the Release Command Center renders, then run JUDGE_RERUN_CHECKLIST.md (#191).

## Deploy record (10 Nov 2026, 11:45:14 UTC / 12:45:14 CET)

- Source: working tree at exactly `b1e4677` (clean); main CI 42736707837 success; manifest diff `0904034..HEAD` EMPTY; `forge lint` clean; CLI latest + portable node 24.22.2.
- Vars stamped pre-deploy: `ANTICIPATE_BUILD_COMMIT=b1e46776c29d424e3b03f3cd3906830f4a9fb927` + `ANTICIPATE_BUILD_AT=2026-11-10T11:43:49.000Z`, re-read via `forge variables list -e production` to confirm, then deployed.
- Assigned version: **4.3.0**. Minor on major 4 (no scope change): toskaman5962 production 4 Up-to-date (auto-update OBSERVED via `forge install list`). Wow #233 ships (collision pair + verdict hero, frontend-only).
- `anticipate-judge` still production 2 Outdated: same site-admin upgrade click (Jira Admin → Apps → Manage apps → ANTICIPATE → Update).
- New installs receive 4.3.0 (same 4 scopes; consent-page re-read not repeated — manifest byte-identical).
- In-app production smoke NOT_VERIFIED (no entitled browser session in this run): owner step — open Apps → ANTICIPATE on toskaman5962, confirm Settings shows Commit b1e4677 + Built 10 Nov 11:43 UTC, the Release Command Center renders, and the portfolio "Complete the collision pair" + glance hero appear on a lone migration, then run JUDGE_RERUN_CHECKLIST.md (#191).

## Deploy procedure (kept for audit; executed above)

From a clean checkout of main `5610ca7` on the owner PC with a logged-in
Forge CLI (pinned CLI 14.2.0, node 24.22.1 as in DEV_RELEASE_CANDIDATE.md):

```powershell
git fetch origin; git checkout 5610ca7
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e production
forge install list
```

Build stamping (#217, every future production deploy): Settings shows the deployed commit from these variables. Set them for the deployed SHA (full 40-char) BEFORE running forge deploy (variables snapshot per deployment — post-deploy changes need another deploy; observed CLI tip 9 Nov):

```powershell
$sha = git rev-parse HEAD # must equal the deployed source commit
forge variables set ANTICIPATE_BUILD_COMMIT $sha -e production
forge variables set ANTICIPATE_BUILD_AT ((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")) -e production
forge variables list -e production
```

Then:

1. Record the assigned version + `forge install list` output in RELEASE.md.
2. Upgrade the owner production install (toskaman5962) if it shows
   "Outdated app"; note any re-consent prompt (expected: none, manifest
   unchanged vs installed major 2 — OBSERVE, do not assume).
3. Smoke (§6 journey): Apps → ANTICIPATE loads "Connected · live mode";
   guided demo preview on a scratch project; analyze → compare → plan;
   Release Command Center renders with no stale data after a project
   switch; no unintended Jira writes.
4. Run `JUDGE_RERUN_CHECKLIST.md` on the shipping build (#191).

## Risk: MEDIUM (version routing), LOW (code)

- Code risk LOW: manifest-identical to installed prod; no storage
  migration; #198 throttle rehash resets throttle budgets once (already
  live on dev 8.1.0 without incident).
- Routing risk MEDIUM: the major-3 experiment sits between installed
  major 2 and this RC. Mitigation: deploy, observe, record; do NOT
  announce shipping until installs show the RC version Up-to-date.

## Rollback

Redeploy production from `113ddc5` (v2.38.0 source, manifest-identical):

```powershell
git worktree add --detach E:\Codegeist2026\.cache\prod-rollback 113ddc5
cd E:\Codegeist2026\.cache\prod-rollback
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e production
```

Verify installs revert + app loads. Remove the worktree afterwards.
Throttle budgets reset again on rollback.

Rollback from 4.2.0: prefer redeploy from `5610ca7`
(manifest-identical, stamped vars for that SHA); deep rollback to
113ddc5 as above.

## Freeze rule

Same as DEV_RELEASE_CANDIDATE.md: docs-only commits never change test
counts. Re-verify `forge lint` + one CI link at submission freeze.

## Provenance re-check (9 Nov 2026, main `ee5dbe1`) — read-only, NOT deployed

Workstream Alpha integrity pass. No production deploy was performed; the
candidate below awaits owner authorization + prod build-var stamping
(see "Build stamping" above).

- Production latest (re-verified via `forge deploy list`, 9 Nov):
  major 4 @ 2026-11-08T13:20:51Z = **4.0.0**, runtime source `5610ca7`
  (timestamp corroborated by the deploy record above + RELEASE.md).
- Installs (re-verified via `forge install list`, 9 Nov):
  `toskaman5962` production 4 Up-to-date; `anticipate-judge`
  production 2 Outdated (site-admin upgrade still pending);
  `one-atlas-euza` development 8 Up-to-date (8.3.0 code — the live
  Settings panel renders the stamped `59d5b11` values).
- Manifest: `git hash-object manifest.yml` on main `ee5dbe1` =
  `b474696d2e2fae62eeda491461431223c3636f30`, byte-identical to the
  recorded 4.0.0 manifest. Scopes unchanged
  (`read:jira-work`, `write:jira-work`, `read:jira-user`,
  `storage:app`; no graph scopes). A production deploy from `ee5dbe1`
  keeps the same permission surface: minor version + no re-consent
  expected — OBSERVE at deploy time, do not assume.
- Runtime delta `5610ca7..ee5dbe1` (32 files, +676/−65) is additive
  only: `getBuildInfo` resolver + `BuildInfo` contract (null-safe) +
  `BuildInfoPanel` UI + 11 unit tests + e2e mocks + docs + CI
  `--retries=1`. No storage change, no migration,
  `SHARED_DECISIONS_RELEASED = false` on both ends, no existing
  operation altered.
- Candidate verdict: `ee5dbe1` is a valid production candidate on
  provenance + CI grounds (main CI green, run 42684235556; dev 8.3.0
  proves the new code hosted with zero writes). Installed 4.0.0 lacks
  `getBuildInfo`, so its Settings shows the unstamped state until a
  future prod deploy. Rollback from an `ee5dbe1`-based prod = redeploy
  from `5610ca7` (manifest-identical; same worktree procedure as
  above, stamped vars for the rollback SHA).
