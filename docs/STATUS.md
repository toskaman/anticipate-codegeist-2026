# ANTICIPATE EXPERIENCE — current status

Worktree: original C: workspace; branch feat/product-experience. CORE owns the unchanged manifest, app identity and backend. Latest fetched CORE ref remains f898235 (bootstrap). No push, deployment, live Jira mutation or verified Forge session has been performed.

## VERIFIED_LOCAL

- Seven local fixture screens and development component gallery; production loads only the Forge capability/access view, with no fixture fallback.
- Single AnticipateClient interface with FixtureClient and ForgeClient; identical provisional runtime schemas for capabilities, projects, snapshots, graphs, comparison results, plans, execution and passports.
- Old DataAdapter/ExperienceAdapter providers and fake approval/execution transitions removed. adapters.ts now only composes view data.
- Graph/dashboard/scenario reads share a validated snapshot; client/data mode and result provenance must agree. Empty project lists remain genuinely empty. Counts are derived from loaded fixture data.
- Main Plan uses action-level review, explicit confirmation and separate backend-approved execution. Fixtures refuse actual approval/execution. Partial/failed backend-response rendering is tested with MOCK transport responses, not Jira.
- Passport checks snapshot/scenario and exports the displayed client payload. No invented approvals or verified execution in fixture reports. One-page print proof exists from the preceding milestone.
- 34 unit tests passed; 18 browser tests passed, including 42 screen/theme/viewport combinations, graph interaction, empty/loading/retry, keyboard focus, main journey/export and production isolation. Lint, formatting, TypeScript and production build pass. The final provenance guard has dedicated unit coverage.

## Pending requirements

- CORE-reviewed packages/contracts, actual resolver bindings and installation/site access. Current schemas are explicitly frontend proposals.
- Forge-hosted routing, Bridge, CSP, theme, authentication and actual Jira outcome verification; none is VERIFIED_FORGE.
- Genuine simulator controls/draft invalidation: current A/B/C results remain authored fixtures, not a simulation engine.
- Graph relation/provenance/freshness expansion, 100+ node/cycle cases, representative performance and long-run reliability.
- Complete screenshot inspection, 200% zoom/long-text checks, rights/license inventory and dependency remediation (last recorded audit: 13 moderate, 5 high).
- Product research/persona/competitive matrix, measured internal impact, Marketplace pack and final real-code jury video. No public submission is authorized by local progress.
- Judge clean-site installation and distribution are CORE/owner-dependent. No installation URL or Apps-menu entry is invented.

Evidence is LOCAL/MOCK only. Current coordination requirements and test details are in docs/coordination/ and evidence/experience/. Historic audits and screenshot milestones remain historical evidence, not current live-integration claims.

Graph milestone: explicit relationships and supplied provenance/freshness/direct-transitive scope now render with matching filters and a bounded visual/list window. Cyclic and 120/1000-node synthetic datasets are tested. Final suite: 41 unit tests, 20 browser tests, lint/format/typecheck/build pass after fixing a connector-position import error found during verification. npm run benchmark:graph records LOCAL model-only median/p95; no browser or Forge performance claim. Details and residual limits are in docs/design/GRAPH_QA.md. Product research, browser/long-run measurements and CORE integration remain open.
