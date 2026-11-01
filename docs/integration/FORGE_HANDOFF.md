# Frontend integration

EXPERIENCE remains in static/hello-world. Run npm ci, npm run typecheck, npm test, npm run build and npm run test:browser there. Node 24 LTS recommended (24.0+); inspected machine currently uses Node 26.7.0.

Build output remains static/hello-world/build with relative asset paths. manifest.yml is unchanged. CORE must review graph inline style CSP needs before deployment. No Forge deployment or live integration was tested.

Provisional domain types and data adapters are in src/domain.ts. Only capabilities, graph and scenario methods exist today. Project snapshots, plan generation, approval, execution and passport endpoints remain integration work. Server must independently authorize each mutation. Replace frontend types with agreed packages/contracts when supplied. Require explicit capability flags, snapshot IDs, evidence provenance and errors for unauthorized, unavailable, stale snapshot and invalid input. Do not silently fall back to demo on failure.

Forge mode currently displays unavailable; it makes no requests. The existing bridge dependency is retained but not imported by the local demo. Its dependency audit findings require coordinated review. Official static-resource documentation: https://developer.atlassian.com/platform/forge/manifest-reference/resources/ .

The expanded ExperienceAdapter in src/adapters.ts now supplies project/snapshot, comparison, plan, local approval/execution and passport operations. All Forge operations explicitly reject pending backend setup. UI approval and execution use the adapter. Remaining fixture reads should be migrated to asynchronous adapter operations with cancellation/loading/error recovery before integration. These provisional signatures are frontend proposals, not existing backend contracts.
