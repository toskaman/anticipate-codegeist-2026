# Production shipping release candidate — main 4ea97f1 (TITAN-8)

Status: VALIDATED, NOT DEPLOYED. Deployment is OWNER AUTHORIZATION REQUIRED
(per-deploy owner approval; no standing production authorization exists).

## Source

- main `4ea97f1` (merge #205; code tree = `40a84e3`).
- Code delta vs installed production v2.38.0 (source `113ddc5`, after #179):
  30 files in `src`, `static/hello-world/src`, `packages`
  (+3168 / −67 lines), spanning #183–#199:
  issue-race/explicit analysis identity, project-scoped releases,
  portfolio generation guards, Release Command Center, Causal Collision
  Explorer, Time Machine retention notice, OMEGA P0 backend hardening
  (#198), a11y display prefs (#199), zod lockfile purge + CI audit gate
  (#205, no source change).
- Docs-only merges #200–#204 included; they change no shipped code.

## Manifest (VERIFIED)

- `git diff 113ddc5 HEAD -- manifest.yml`: EMPTY. The shipping manifest is
  byte-identical to the installed production manifest.
- Fingerprint: `git hash-object manifest.yml` =
  `b474696d2e2fae62eeda491461431223c3636f30` (same on both ends).
- Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`,
  `storage:app`. No graph scopes, no Teamwork Graph, no shared-decision
  release (`SHARED_DECISIONS_RELEASED = false`), no licensing change.
- Consequence: a production deploy from this source introduces no new
  permission surface. Whether Forge assigns a major or minor version, and
  whether installs re-consent, must be observed at deploy time (see
  "Version trap" below) — not assumed here.

## Validation evidence

All gates executed on trees code-identical to the RC (main `4ea97f1`):

| Gate | Result |
|---|---|
| Backend `npm test` | 326/326 (38 files), local |
| Contracts / simulation-core | 12 / 75, local |
| Frontend vitest / typecheck / lint / build | 201/201, exit 0, exit 0, build ok, local |
| Playwright listed | 190 in 31 files (`--list`) |
| Playwright executed, local (chromium 150 + firefox 20 + webkit 20) | 190/190 (2.0m), exit 0 |
| Cloud CI on #205 (run 42433936416) | core pass 1m3s, frontend pass 59s (incl. new audit step), e2e pass 7m41s |
| `forge lint` (CLI 14.2.0) | No issues found |
| `npm audit --omit=dev --audit-level=high` | root 5 moderate / 0 high; frontend 4 moderate / 0 high |
| Demo 2 deterministic verdict pins | PASS (backend suite, incl. named-reason pins) |
| Rovo 7-handler local probe | 7/7, zero Jira writes (T6 record, handlers unchanged since) |
| KVS 240 KiB boundary probe | 4/4, warn path confirmed (T6 record, storage code unchanged since) |

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

The RC deploy from `4ea97f1` carries the approved committed manifest,
which differs from the deployed-never-installed major 3. The owner must
observe at deploy time: the version number Forge assigns, whether the
Developer Console offers the new version as the installable latest, and
whether existing installs ask for re-consent. Record all three before
announcing the shipping build.

## Deploy procedure (owner only)

From a clean checkout of main `4ea97f1` on the owner PC with a logged-in
Forge CLI (pinned CLI 14.2.0, node 24.22.1 as in DEV_RELEASE_CANDIDATE.md):

```powershell
git fetch origin; git checkout 4ea97f1
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e production
forge install list
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
git worktree add E:\Codegeist2026\.cache\prod-rollback 113ddc5
cd E:\Codegeist2026\.cache\prod-rollback\ANTICIPATE
$env:Path = "E:\Codegeist2026\.cache\node-dist\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
forge deploy -e production
```

Verify installs revert + app loads. Remove the worktree afterwards.
Throttle budgets reset again on rollback.

## Freeze rule

Same as DEV_RELEASE_CANDIDATE.md: docs-only commits never change test
counts. Re-verify `forge lint` + one CI link at submission freeze.
