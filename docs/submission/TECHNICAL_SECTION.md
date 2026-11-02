# Devpost — "How we built it" (CORE input for the EXPERIENCE-owned submission text)

ANTICIPATE is a Forge app (`global:fullPage` Custom UI + Node.js 24 resolvers, Forge KVS storage, `rovo:mcp` module) built for Jira Cloud.

**Real Atlassian integration.** All Jira reads and writes run `asUser()`, so Jira enforces the viewer's own permissions. The backend reads projects, JQL search (`/rest/api/3/search/jql`), issues, issue links and components, and checks `mypermissions` immediately before any write.

**Evidence graph.** A bounded breadth-first crawler (depth ≤ 5, ≤ 200 nodes, cycle-safe) turns Jira links into a directed evidence graph. Every edge keeps its source link id, extractor, observation time and an epistemic status: `Blocks`/dependency links are CONFIRMED, `relates to` is INFERRED context only, and anything the user cannot read stays UNKNOWN — never assumed safe.

**Deterministic counterfactuals.** `packages/simulation-core` is a pure TypeScript engine: each scenario (remove now / retain temporarily / migrate consumers first) is applied to an isolated copy of a frozen snapshot, impacts are traced through reverse dependency edges with causal paths, three policy rules are evaluated, and every result carries a reproducible hash. No probabilities or invented savings.

**Verified prevention.** Plans are read-only until a human approves specific actions; approval is bound to the plan hash and expires with the 24-hour snapshot. Execution takes a per-plan lease, records each action, reconciles via marker labels/comments before any create (no duplicate issues after retries or lost responses), and only reports VERIFIED after re-reading Jira. Partial failures are reported as PARTIAL.

**Prevention Passport.** An auditable record of the snapshot, compared alternatives, approvals, attempts, verified outcomes and open unknowns.

**Rovo MCP.** Three read-only tools (`anticipate-get-graph`, `anticipate-simulate-retirement`, `anticipate-get-passport`) expose the same deterministic engine to Rovo and external MCP clients (subject to admin enablement).

**Quality.** Shared zod contracts validate every request and response; 16 backend + 3 contract + 8 engine tests (fake Jira, including partial failure, retry, stale approval, expired snapshot, concurrency and cross-user access); GitHub Actions CI; 100-node, 3-scenario comparison measured at ~18 ms.

**Known limitations.** Policies are enforced inside ANTICIPATE (not yet as a Jira workflow validator); `global:fullPage` and `rovo:mcp` are Preview modules; the app opens via its full-page URL rather than a guaranteed Apps-menu entry.
