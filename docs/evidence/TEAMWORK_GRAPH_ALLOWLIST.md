# Teamwork Graph: allowlisting evidence (for judges)

ANTICIPATE has a Teamwork Graph integration ready (prototype adapter `src/context/twg.ts`, read-only hosted probe on branch `exp/teamwork-graph`), but Atlassian has not yet enabled the Teamwork Graph API for this app. We do not claim Teamwork Graph as live.

## Allowlist request
- Ticket: [ECOHELP-180616](https://ecosystem.atlassian.net/servicedesk/customer/portal/34/ECOHELP-180616), "Teamwork Graph API allowlist request — Forge app 39a28f48-c891-4d86-a3cf-c14409cbd29e"
- Opened: 2 Nov 2026, 04:03:01 PM
- App id: 39a28f48-c891-4d86-a3cf-c14409cbd29e (the same app as the submission)

## What we observed (3 Nov 2026, development environment, site one-atlas-euza)
| Time (Paris) | Step | Result |
|---|---|---|
| 13:01 | `forge deploy` with `read:graph:jira` | Refused: "Manifest validation failed: The restricted scope read:graph:jira is not allowed for app 39a28f48-…" |
| 13:02 | `forge deploy` with `read:graph:issue:jira` only | Deployed (dev v5.0.0), installation upgraded |
| 13:05 | Rovo agent runs the read-only probe on MOBL-58 | Asks for user authorization |
| 13:20 | User authorization completed | The issued authorization lists only `read:jira-work`, `write:jira-work`, `read:jira-user`, `offline_access`: `read:graph:issue:jira` is not granted |
| 13:25 | Probe re-run | Still asks for authorization: the graph scope cannot be granted until the app is allowlisted |
| 13:30 | Rollback | Dev redeployed from the CORE branch without graph scopes (v6.0.0); production never changed |

Atlassian documentation: "If you get `Authentication failed` or `Unauthorized`, your app must be allowlisted. Contact Atlassian support with your app ID." (Call the Teamwork Graph API, Forge docs, Preview).

## Activation plan once allowlisted
1. Redeploy `exp/teamwork-graph` to development, run the probe on MOBL-58, record the real relations.
2. Wire `teamworkGraphSource` behind the existing `GraphSnapshot.coverage` contract: Teamwork Graph relations are DOCUMENTARY context, never change a verdict.
3. Owners decide on the production scope change (all installations re-consent).
