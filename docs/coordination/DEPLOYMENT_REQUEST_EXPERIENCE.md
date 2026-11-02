# EXPERIENCE -> CORE: authorized development deployment request

Requested 2026-11-02, 13:02 Europe/Amsterdam (12:02 UTC). State: REQUESTED, not deployed by EXPERIENCE.

The owner explicitly answered "both" when asked whether to request a CORE development deployment and continue frontend improvements. This supersedes the previous deferral for the pinned candidate below. CORE remains the deployment owner under AGENTS.md; EXPERIENCE will not invoke Forge CLI.

## Pinned candidate

- Repository: toskaman/anticipate-codegeist-2026; branch feat/product-experience.
- **Deploy source commit: 4c68d90fc0990b751cb7bfa7dc6d0f2a77f60c12.**
- Includes frontend reflow fixes from 246da8b and CORE issueLink/empty-response/manifest cleanup from 6356a28. Do not deploy the older frontend candidate over this backend fix.
- [Candidate CI](https://github.com/toskaman/anticipate-codegeist-2026/actions/runs/41441118597): frontend and CORE jobs completed successfully.
- Local verification: 42 frontend unit, 51 browser, 18 CORE, 3 contract and 8 simulation tests pass; formatting, lint, root/frontend TypeScript and build pass.
- Static resource remains static/hello-world/build. Build hashes and MOCK_TRANSPORT evidence: evidence/experience/core-reflow/.

## Requested action and boundaries

Please build fresh from this exact source in the existing repository/worktree and deploy **development only** to the existing app:

- appId: ari:cloud:ecosystem::app/39a28f48-c891-4d86-a3cf-c14409cbd29e
- site: one-atlas-euza.atlassian.net
- existing development installation: 2ae8efdf-84b8-4851-a341-e4fa2499595c
- routePrefix: hello-world

Verify the installation belongs to development before acting. Registration, app creation, production, sharing/distribution changes and new scope grants are outside this request. If any is required, report the blocker. Preserve unrelated working trees. The manifest already includes CORE's removal of development web triggers; do not restore those triggers for this deployment.

## Owner identity requirement

The requester explicitly requires **their approved Forge identity, never the colleague's token**. Do not reuse an earlier CLI/browser identity simply because it worked. Verify that the active deployment identity is approved by the requester and has access to this existing app. No token is included or transferred through this file. Do not copy credentials from chat/repository logs. If approved credentials/permissions are unavailable, reply BLOCKED_IDENTITY or BLOCKED_ACCESS instead of using another identity or registering an app.

## Acceptance and response

After deployment, report the source SHA, environment, app/installation confirmation, deployed version, launch URL, and actual result or blocker. Use the owner-approved session for a read-only smoke check if available. No seed, deletion or unreviewed Jira write is authorized by this relay. Real Jira actions must be reviewed by their exact targets/actions before approval/execution.

Reply in CORE_RESPONSE_TO_EXPERIENCE.md or the CORE status file. A deployment report is distinct from authenticated user-context acceptance; do not infer a successful Jira operation from local tests or a successful upload. Existing dependency/security/license release work remains open and this request grants no production/release clearance.
