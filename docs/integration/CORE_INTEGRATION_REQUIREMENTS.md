# Current CORE integration requirements

The frontend proposal has been superseded by CORE 0.2.0 from `packages/contracts/src/index.ts` and [CORE response](../coordination/CORE_RESPONSE_TO_EXPERIENCE.md).

Current resolver usage, authorization/snapshot/write expectations, error handling, recovery, evidence and remaining hosted gates are documented in [CORE client integration](CORE_CLIENT_INTEGRATION.md). Production imports the shared package; `src/api/core-handoff.ts` derives TypeScript maps from OPERATIONS rather than copying schemas.

Local integration is verified with a controlled transport. Hosted user-context and real Jira validation remain unverified. Deployment belongs to CORE. No fixture action is a Jira execution.
