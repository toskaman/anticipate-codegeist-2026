# Forge handoff — CORE 0.2.0 connected frontend

CORE 39b59df is merged. Production now loads the seven-screen CoreWorkspace and invokes the exact shared OPERATIONS through Forge Bridge. The installed contracts source matches the checked-in source. No fixture fallback, guessed resolver names or simulated approval/execution.

Read [CORE client integration](CORE_CLIENT_INTEGRATION.md) for the operation matrix, input/output types, planHash approvals, recovery by planId, validation boundaries, tests and deployment gates. Build output remains static/hello-world/build; the existing Forge identity/module are unchanged from CORE.

No deployment or real Jira write has been performed by EXPERIENCE. The development launch URL from CORE redirects an unauthenticated browser to Atlassian login. Hosted acceptance requires the current frontend build to be deployed by CORE/owner and an authorized user session.
