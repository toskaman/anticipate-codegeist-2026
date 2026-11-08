# Teamwork Graph Preview plan (TITAN-9, 8 Nov 2026) — PREPARED, NOT EXECUTED

## Support answer (ECOHELP-180616, Deepak Pandey, Ecosystem Support)

- The Teamwork Graph API is in **Preview**: the app **no longer needs to be
  allowlisted** by Atlassian.
- The deploy error came from a scope supported during the EAP but since
  **retired**: the product-wide `read:graph:jira` (and `read:graph:confluence`).
- Fix: replace it with per-object-type scopes from the scope reference.
- Sources (verified 8 Nov 2026):
  `https://developer.atlassian.com/platform/teamwork-graph/scopes/#moving-off-the-eap-scopes`
  `https://developer.atlassian.com/platform/teamwork-graph/scopes/#scope-reference`
  `https://developer.atlassian.com/platform/teamwork-graph/migrate-from-raw-cypher/`
  `https://developer.atlassian.com/platform/teamwork-graph/persisted-cypher-queries/`
  `https://developer.atlassian.com/platform/teamwork-graph/curated-queries/`

This matches our 3 Nov probe exactly (deploy refused with `read:graph:jira`,
accepted with `read:graph:issue:jira` — see TEAMWORK_GRAPH_ALLOWLIST.md).

## Scope mapping for our three prototype relations (all read-only)

| Prototype relation (`src/context/twg.ts`) | Object types touched | Scopes required |
|---|---|---|
| `jira_work_item_impacts_compass_component` | JiraWorkItem → CompassComponent | `read:graph:issue:jira` + `read:graph:component:compass` |
| `jira_work_item_links_external_build` | JiraWorkItem → ExternalBuild | `read:graph:issue:jira` + `read:graph:build:external` |
| `jira_work_item_links_jira_work_item_remote_link` | JiraWorkItem → JiraWorkItemRemoteLink | `read:graph:issue:jira` + `read:graph:issue-remote-link:jira` |

Total: **4 new scopes** (well under the Forge 50-scope cap). Every hop needs
its own object scope; unheld types are silently omitted from mixed
traversals, so all four are required for honest coverage.

## Raw-Cypher ban → migration design

Platform rule: "Apps can no longer send arbitrary Cypher text to Teamwork
Graph at request time." Our prototype builds Cypher at runtime
(`cypherFor(rel)` interpolates the relation), so it must migrate:

- Curated queries: catalog checked 8 Nov (user-assigned/reported items,
  goals, comments, external designs/deployments/PRs). **No match** for our
  traversals; closest (`jiraWorkItemLinkedExternalDeployments`) returns the
  wrong object type (deployments, not builds).
- Therefore: **3 persisted Cypher queries**, one per fixed shape in
  TWG_RELATIONS (parameterized by value `$id` only — exactly the documented
  pattern). Runtime calls the `customQuery` GraphQL field with
  queryKey + params; no Cypher text on live requests.
- Registration (setup-time, contributor-only): TWG Labs UI
  (`https://teamwork-graph.atlassian.com/query-builder`, "Saved queries" tab)
  or the registration endpoint directly; returns a UUID `queryKey` (~1 min
  propagation); re-submitting identical text returns the original key
  (200, no duplicate). Store each key in app config next to the caller.

Code sketch (not implemented): replace `cypherFor` with a
`relation → queryKey` map (keys injected via config, never guessed);
replace the `GRAPHQL` document's `cypherQuery(query:...)` with
`customQuery(key:..., params:...)`; keep `parseRows`, `MAX_KEYS/MAX_ROWS`,
merge rules (INFERRED-only, PARTIAL/UNAVAILABLE honesty), and all existing
`twg.test.ts` guarantees. The `GraphPort` seam already isolates the call.

## Isolated dev experiment (needs owner deploy approval — NOT RUN)

1. Owner registers the 3 queries (contributor), records the 3 queryKeys.
2. Branch `exp/teamwork-graph`: implement the `customQuery` migration +
   declare the 4 scopes in the experiment manifest only.
3. `forge deploy` to **development**; confirm user consent now grants the
   graph scopes (the 3 Nov failure was the allowlist — must re-verify).
4. Run the read-only probe on MOBL-58; record real relations, partial-result
   behavior, latency, and zero-write proof.
5. Roll dev back to the RC code afterwards; keep the experiment manifest out
   of `main` until an explicit owner release decision.

## Production decision (owners only, AFTER the experiment)

- Adding 4 scopes = new major version + **every installation re-consents**.
- The shipping RC (`PROD_RELEASE_CANDIDATE.md`) stays TWG-free; judge
  install-link behavior must not change before submission.
- Options: (a) ship RC as-is, add TWG in a later release; (b) delay
  submission for a TWG release (re-consent risk on judge installs).
  Recommendation: (a) — the MCP bonus is the primary target and TWG adds
  documentary context only (it never changes a verdict by design).

## Bonus impact

A working dev integration + a production release would open the "Best apps
with Teamwork Graph integration" bonus. Until then: not claimed. The MCP
bonus remains the primary target (one Grand Prize + one Bonus max per rules).
