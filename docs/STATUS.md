# ANTICIPATE EXPERIENCE — current status

VERIFIED_LOCAL milestone: performance, visual quality and CORE integration readiness (2026-11-02). Branch feat/product-experience. CORE-owned manifest, backend and Forge identity remain unchanged. Publication to this branch and a Draft PR are now explicitly authorized; no merge or deployment.

- Seven labeled fixture screens, bounded provenance-aware Evidence Graph, scenario comparison, policy review, per-action review and consistent Passport export.
- Production loads Forge capability/access UI only. No fixture fallback and no simulated Jira success.
- 41 unit tests, 26 browser tests (including 42 screen/theme/viewport cases), model benchmark, TypeScript, lint, formatting and production build pass.
- Exact 100/500/1,000-node datasets measured in Chromium. See [performance and visual audit](design/PERFORMANCE_VISUAL_CORE.md) and raw evidence/experience/performance-visual-core. No SLA or statistically significant improvement is claimed.
- [CORE requirements](integration/CORE_INTEGRATION_REQUIREMENTS.md) define TypeScript maps, operation inputs/outputs, snapshot handling, authorization, errors and hosted acceptance gates.

CORE integration remains BLOCKED: reviewed contracts/bindings, scenario-linked plans/executions, structured Passport audit/error envelope and an authorized Forge installation are required. Latest fetched CORE branch is e621241; it was not merged or validated as an integration during publication preparation. Local results do not imply VERIFIED_FORGE.

Known limits: authored A/B/C results, C-only authored plan, sparse synthetic graph workloads, no total-process memory/long-soak certification, client-side paging, no full assistive-technology audit. Dependency advisories (13 moderate / 5 high at last recorded audit), ten missing root-license texts and custom Forge terms need release review. Product research contains unvalidated persona/pricing hypotheses. See docs/product/RESEARCH.md, docs/design/ASSET_LICENSES.md and historical milestone manifests under evidence/experience.
