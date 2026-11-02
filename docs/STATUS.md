# ANTICIPATE EXPERIENCE — current status

Frontend baseline: **4c68d90fc0990b751cb7bfa7dc6d0f2a77f60c12**, CORE contracts 0.2.0. CORE follow-up `1225a72` changes Rovo caller identity resolution and adds a regression test; merged through report `41c6c59`. Frontend source remains unchanged. EXPERIENCE has not authored changes to the merged backend, shared contracts, manifest or Forge identity.

## Deployment and distribution

CORE reports development **4.8.0** with an authenticated read-only smoke, and production **2.1.0** from the runtime candidate. In `745fe69`, CORE reports successful production installation through the judge link on a second clean site and the honest empty-project state. This supersedes earlier deployment-request/deferral notes. These are CORE reports, not independent EXPERIENCE hosted verification.

The requester authorized the existing Forge app owner identity and delegated publisher name, support and public privacy details to CORE. [Installation link](submission/INSTALL_LINK.md) · [owner authorization and response](coordination/PRODUCTION_GO_EXPERIENCE.md). CORE reports sharing enabled and policy/terms published on GitHub. EXPERIENCE has flagged factual policy review items; publication does not imply legal clearance.

GitHub reports PR #2 merged into main as `1c77eea` at 2026-11-02 13:04:58 UTC. EXPERIENCE did not perform the merge or a Forge deployment. Follow-up documentation remains on feat/product-experience.

## Frontend and evidence

All seven hosted screens use the CORE client: project/change pagination, explicit snapshot capture, bounded accessible evidence graph, scenario-linked plans, planHash approval, separate execution confirmation, lost-response recovery and matching Passport export. Local fixtures and mock transport remain labeled and isolated; there is no production fixture fallback.

Latest full local run: **42 frontend unit / 51 browser tests**, build, TypeScript, lint and formatting passed. Candidate verification also passed **19 CORE / 3 contract / 8 simulation tests** after merging the Rovo follow-up. CI for `d518dbe` passed frontend clean install/build and CORE checks in run `41450610699`. Browser tests remain local/mock evidence; CI does not run that browser suite.

[Integration handoff](integration/CORE_CLIENT_INTEGRATION.md) · [reflow evidence](integration/CORE_REFLOW_READINESS.md) · [historical performance measurements](design/PERFORMANCE_VISUAL_CORE.md). No hosted performance SLA or speedup is claimed.

## Remaining gates

Independent hosted journey, host permissions, real Jira outcomes and lost-response recovery remain unverified by EXPERIENCE. CORE's clean-site smoke establishes reported installation/empty-state behavior, not that entire journey. CORE now reports external Rovo MCP validation through its Claude connector on the original site: graph (8 nodes/7 relations), A/B/C simulation and Passport (COMPLETED, 6/6 VERIFIED records). Report `41c6c59` names development **4.9.0** / production **2.2.0** following the caller-identity fix. This supersedes the earlier pending MCP client gate; EXPERIENCE did not independently repeat it. Reading existing VERIFIED records is not evidence of new writes in that MCP check. The workflow validator remains deferred.

Dependency findings remain: full frontend audit **13 moderate / 7 high**; production-only audit **3 moderate / 7 high**; previous root audit **15 moderate / 2 high / 2 critical**. [Dependency triage](integration/DEPENDENCY_TRIAGE.md) explains pinned transitive versions. CORE records Zod risk acceptance for the hackathon; this is not remediation or independently verified mitigation. Eleven missing root license texts/custom terms still require review. No security/legal clearance is claimed.

Follow-up check after merging `41c6c59` on 2026-11-02: 19 CORE, 3 contract, 8 simulation, 42 frontend unit and 51 browser tests passed (browser run 39.7 s). Root/frontend TypeScript, frontend lint, formatting and build passed. No authored backend change or deployment was performed by EXPERIENCE; the Rovo change is merged from CORE. Historical browser captures were preserved rather than overwritten by this verification run.
