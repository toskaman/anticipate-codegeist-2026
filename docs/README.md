# Frontend developer guide

Use the [project README](../README.md) for Windows setup, judge sample preparation, genuine screenshots and check commands. [STATUS](STATUS.md) and [release readiness](design/UI_RELEASE_READINESS.md) record current verification; older reports retain their dated scope.

## Two separate entry paths

`static/hello-world/src/index.jsx` selects the isolated `App.tsx` fixture prototype for standalone development, or `ForgeApp.tsx` for production and Forge-hosted development. The prototype never mutates Atlassian. The connected entry uses the Forge bridge and fails explicitly outside a supported installation; it never substitutes fixtures.

`CoreWorkspace.tsx` is the UI v3 composition root. `app/useCoreWorkflow.ts` owns operation state, snapshot/plan identity, approval and execution guards, recovery, evidence-drift refusal and sample busy/replacement state. `app/journey.ts` derives navigation state from actual artifacts. `features/` contains the seven screens; `components/` holds shared UI and confirmation dialogs; `styles/anticipate.css` provides scoped styles. The lazy graph renders bounded 8/20/36-node windows, discloses off-window edges and offers an accessible list.

## CORE boundary and slow operations

`api/ForgeClient.ts` validates inputs and LIVE envelopes with `@anticipate/contracts`. Provisional schemas serve only the fixture prototype. It preserves structured errors, correlates artifacts and refuses malformed or fixture responses in LIVE mode. Default request observation is 12 seconds; confirmed sample creation gets 60 seconds because CORE reports 15–20 seconds of sequential Jira writes. An explicitly injected timeout remains available to the test harness. Timing out or aborting observation does not cancel or roll back server work. Never automatically retry a mutation; re-preview sample data or recover plan execution status first.

Evidence refusal details are rendered on Plan, Firewall and Passport. Refused plans cannot be re-approved or executed, including after refresh/recovery. Rebuild a snapshot and compare again. Sample creation requires a read-only preview and separate confirmation in an accessible existing Jira project.

## Verification

Run frontend TypeScript, lint, formatting, unit tests, build and Playwright before handoff. `npm run test:browser` builds and starts the configured local test servers; one worker avoids the harness's intentionally short request timeout under concurrent load. Install Chromium first; Firefox/WebKit are needed for scoped engine runs. Browser captures use explicit MOCK_TRANSPORT provenance. See [visual QA](design/UI_VISUAL_QA.md) for native screenshots and [release readiness](design/UI_RELEASE_READINESS.md) for exact results and known retries.

Build output, node_modules and test-results stay untracked. Preserve unrelated user outputs. Only CORE registers, deploys or changes the existing Forge app. Hosted acceptance, permissions, real Jira outcomes and native assistive-technology testing are separate from local checks.
