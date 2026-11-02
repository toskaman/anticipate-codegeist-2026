# Forge handoff — current v2 boundary

EXPERIENCE owns static/hello-world; CORE owns the existing backend, manifest, permissions and deployment. Build output remains static/hello-world/build with relative URLs. Existing app identity is preserved. No deployment or live integration has been verified by EXPERIENCE.

Production entry loads ForgeApp. Development entry loads the labeled fixture prototype; production never falls back to it. ForgeApp opts into host theming through a lazy Bridge import and handles unavailable host context in local preview. CORE must verify actual CSP, routing, authentication, theme behavior and the full-page launch URL after an approved development deployment.

The TEMPORARY AnticipateClient proposal is in src/api/provisional-contracts.ts. ForgeClient has an empty resolver map until CORE supplies real identifiers. It validates capability/project payloads plus plan, execution and passport responses, suppresses fixture payloads in Forge mode and bounds observation with timeout/abort. Aborting a Bridge promise does not roll back a backend write.

ActionReview is now in the main Plan screen: selected action IDs and plan version are confirmed before approval; execution is separate, requires approved actions, and uses a request key. A delayed response triggers status inspection rather than automatic resubmission. PARTIAL/FAILED outcomes are rendered without inventing success. FixtureClient supplies an authored review plan but rejects real approvals and execution. PassportView validates snapshot/scenario and exports the same data it displays; fixture timelines remain empty.

Graph/dashboard/scenario projections still use the legacy development view adapter. Consolidation into the shared client remains open. Scenario results are authored fixtures, not a simulator. Replace provisional schemas with packages/contracts after CORE review rather than assuming our proposed fields are authoritative.

Exact operation/input/error requirements and hosted acceptance tests are in ../coordination/frontend-integration-requests.md. Required access includes an owner-provided installation link, site, installation UUID and authorized test permissions. No Apps-menu entry, bonus integration, or successful Jira mutation should be inferred from screenshots or local tests.
