# ANTICIPATE EXPERIENCE — current status

## UI v3 delivery

Branch `feat/product-experience` integrates UI bundle `499522d` over evidence-drift/sample work `7fefdbc`, with main synchronized through `6641e43` (CORE `7a6c80b`). EXPERIENCE authored only frontend, frontend documentation and local visual evidence. Backend, shared contracts and manifest changes come from CORE merges.

All seven hosted screens use the CORE client. The v3 shell provides journey navigation, a bounded layered evidence graph with provenance paths, scenario cards, policy explanations, separately confirmed approval/execution, a report-style Passport and capability transparency. Workflow state lives in `static/hello-world/src/app/useCoreWorkflow.ts`; `CoreWorkspace.tsx` remains the composition root.

Preserved safety: structured EVIDENCE_CHANGED details, persistent refusal of the old plan, cleared selection/confirmation, optional freshness checks, planHash/idempotency guards, lost-response recovery, raw Passport status, and sample preview before explicit real Jira creation. Opening, previewing or cancelling the sample panel never writes Jira. Timed-out sample creation may still be running; the UI directs re-preview before any further creation and never resubmits automatically. Demo fixtures remain isolated and labelled.

## Verification and evidence

Fresh installs, frontend/root TypeScript, frontend ESLint/Prettier, 47 frontend unit tests, 43 CORE tests, 3 contract tests, 10 simulation tests and the Vite build passed against the synchronized main. Exact browser counts, timings, focused retries and final follow-ups are in [release readiness](design/UI_RELEASE_READINESS.md) and `evidence/experience/v3-redesign/verification/`. Browser/axe results and native screenshots are LOCAL/MOCK_TRANSPORT; they are not hosted Forge evidence. GitHub CI separately installs/builds the frontend and runs CORE checks. Final head SHA, remote match and CI run are recorded in the publication PR.

[Visual QA and screenshot index](design/UI_VISUAL_QA.md) · [design system](design/DESIGN_SYSTEM_V3.md) · [integration audit and label changes](design/UI_REDESIGN_AUDIT.md) · [jury showcase](jury/JURY_UI_SHOWCASE.md) · [CORE client handoff](integration/CORE_CLIENT_INTEGRATION.md). Historical graph measurements remain in [performance evidence](design/PERFORMANCE_VISUAL_CORE.md); no new hosted performance SLA or speedup is claimed.

## CORE reports and remaining hosted gate

CORE's [evidence pack](evidence/EVIDENCE_PACK.md) reports production 2.7.0 with the previous frontend (PR #9), successful sample creation/re-preview/analysis on development, a grounded Rovo agent response, and optional workflow-validator tests in isolated project AVT. CORE also reports the new dependency-upgrade MCP scenario on development 4.19.0. These reports supersede earlier pending-agent/validator notes; EXPERIENCE has not independently repeated them. The frontend's scenario picker still presents the retirement journey. Settings reflects the five declared read-only MCP tools and optional workflow validator without treating declaration as verified availability.

UI v3 hosted rendering, host iframe/theme behavior, permissions, real Jira outcomes and lost-response recovery still require authenticated acceptance by CORE. Native browser zoom, screen-reader testing and a long stability soak remain unrun. No app registration, Forge identity change, deployment or PR merge was performed by EXPERIENCE.

The requester authorized the existing Forge owner identity and assigned public publisher, support and privacy-policy details to CORE. [Owner authorization](coordination/PRODUCTION_GO_EXPERIENCE.md) · [installation link](submission/INSTALL_LINK.md). Historical deployment source/version records remain in coordination reports; none certify UI v3 production readiness.

## Known dependency/legal limitations

Installed dependency findings remain frontend 14 moderate / 2 high and root 15 moderate / 2 high / 2 critical. Eleven missing root license texts/custom terms still require review. [Dependency triage](integration/DEPENDENCY_TRIAGE.md) records context and existing risk acceptance; this UI work claims no security or legal clearance. Unrelated local `Claude outputs/` is preserved and excluded from publication.
