# Hosted acceptance — dev 8.x, 8 Nov 2026 (T7-2, read-only)

Site: `one-atlas-euza.atlassian.net` (Jira). Installation: development, major 8
(Latest), Up-to-date (`forge install list`, 8 Nov). Minor 8.1.0 INFERRED-STRONG
(second major-8 deploy, owner, 7 Nov 21:34:50 CET; see
`docs/deployment/DEV_RELEASE_CANDIDATE.md`). No login, deploy, install, or data
change was performed in this pass: navigation clicks only, zero Jira writes.

Session: project capture browser (owner machine), page open on the full-page app.
Method: CDP text-walk + screenshots. Screenshot capture hung intermittently
(environmental: a video-capture utility still attached to the browser surface);
text assertions succeeded on every step.

## Result: 6/6 journey steps live and consistent

Context pill identical on all steps: Project AVT · Change AVT-3 · Option
Migrate first · Plan Completed. No stale-context display observed.

| Step | Nav time* | Observed |
| --- | --- | --- |
| Mission Control | ~2.0 s | Loads, context pill correct |
| Evidence Graph | ~0.1 s | 7 records incl. AVT-1 (drift link persisted), Confirmed/Inferred legend, Jira sources, observed 07 Nov 22:19 CET |
| Scenario Lab | ~2.1 s | Loads, context correct (screenshot hung; text-only) |
| Decision Firewall | ~2.0 s | MIGRATE FIRST: "No policy violation reported", Pass, what-if assumption stated |
| Prevention Plan | ~0.1 s | Loads, context correct |
| Prevention Passport | ~1.0 s | Radar Listening (7 indexed), Time Machine completed, 3 unchanged checkpoints (21:19/21:22 UTC), compare shows "No recorded difference" |

\* Including a fixed 2.5 s settle wait; real render faster.

## Capabilities (Settings, backend-reported)

Jira read/write Available; Rovo MCP tools Permission required; Rovo agent
Available; Confluence/Teamwork Graph Not configured; workflow validator
Available. Matches the video evidence manifest.

## Performance (Settings → Performance in this session)

First content 189 ms after frame start; workspace connected (capabilities +
projects) 1675 ms. Single sample, warm backend.

## Screenshots

`hosted-2026-11-08/10-mission-dev-8x.jpg`, `11-graph-dev-8x.jpg`,
`13-firewall-dev-8x.jpg`, `14-plan-dev-8x.jpg`, `15-passport-dev-8x.jpg`.

## Not covered in this pass

Approval/execution writes, evidence-change refusal re-run, Release Command
Center portfolio flows, MCP/Rovo live calls, second-account checks. The
yesterday film session covers refusal/execution on this same install; a write
pass needs explicit owner approval per action batch.
