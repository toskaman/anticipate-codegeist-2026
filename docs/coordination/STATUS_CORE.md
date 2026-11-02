# STATUS — CORE (2026-11-02, session 1)

Branch `feat/core-engine` · base `f898235` · contracts **0.2.0** (non-breaking over 0.1.0: `getGraphSnapshot.source/maxDepth`, `getEvidenceGraph`, `getPolicies`)

| Feature | Status | Evidence |
|---|---|---|
| Contracts + fixtures | TESTED 3/3 | `npx vitest run --root packages/contracts` |
| Simulation engine | TESTED 8/8, perf 100 nodes ≈ 17–19 ms (container) | `npx vitest run --root packages/simulation-core` |
| Resolvers (13 ops, envelope, validation, logs) | TESTED (fake Jira) 12/12 | `npm test` |
| Jira read adapter (projects, JQL search, issue, links, components, permissions) | IMPLEMENTED, not run against real Jira | src/forge-adapters.ts |
| Graph extractor (bounded BFS, link semantics, UNKNOWN for unreadable) | TESTED (fake) | src/jira/extractor.ts |
| Plans / approvals / idempotent verified writes / passport | TESTED (fake), incl. partial failure, retry, lost response, stale, expired, concurrent, other user | test/service.test.ts |
| Rovo read-only actions | TESTED (fake); manifest fragment NOT merged | src/rovo.ts, docs/integrations/manifest-rovo.yml |
| Manifest scopes `read:jira-work, write:jira-work, read:jira-user, storage:app` | CHANGED, not linted (needs authenticated CLI) | manifest.yml |
| Bundle smoke (esbuild, node22) + direct resolver invocation | PASS | — |
| Forge deploy / install | BLOCKED (owner auth) | — |

## For EXPERIENCE
- Call `invoke(op, payload)`; every response is `{ ok, meta: { contractVersion, requestId, mode, generatedAt }, data | error }`.
- Flow: `listProjects` → `getChangeCandidates({projectId})` (issues labelled `anticipate-change`) → `getGraphSnapshot({projectId, rootIssueKey})`
  → `compareScenarios({snapshotId, change, scenarios})` (use 3 scenarios: REMOVE_NODE / DEPRECATE_NODE / MIGRATE_DEPENDENTS+REMOVE_NODE on `issue:<KEY>` node ids)
  → `generatePreventionPlan({snapshotId, scenarioId})` → `approvePlan({planId, planHash, approvedActionIds, idempotencyKey})`
  → `executeApprovedPlan({planId, idempotencyKey})` → `getExecutionStatus` / `getPreventionPassport({planId})`.
- No-Jira demo: `getGraphSnapshot({projectId:'demo', rootIssueKey:'demo', source:'DEMO_FIXTURE'})` → `meta.mode = DEMO_FIXTURE`; execution is refused (UNSUPPORTED).
- Generate idempotency keys client-side (≥16 chars, e.g. `crypto.randomUUID()`), reuse the same key when retrying the same click.
- Legacy `getText` resolver kept for the current template UI.
