# Local frontend developer guide

## Prerequisites and startup

Use Node 24 LTS, at least 24.0 (the installed development machine uses 26.7.0). From the repository root, enter static/hello-world and run npm ci, then npm start -- --host 127.0.0.1. Open http://127.0.0.1:3000. No credentials or separate backend are required. Build with npm run build; static assets are emitted to static/hello-world/build with relative URLs, matching the existing manifest resource. Do not modify manifest.yml for local development.

## Repeatable checks

Run npm run typecheck, npm run lint, npm run format:check, npm test, npm run test:browser and npm run build from static/hello-world. On first browser setup run npx playwright install chromium. npm run format applies the repository formatter. Browser results go to test-results; screenshots go to the repository evidence folder. Browser tests use the running local server when available. Component Showcase appears in development navigation only and has reproducible empty/error/loading previews.

## Architecture and trust

App.tsx composes screens and local state. domain.ts holds temporary frontend types and authored fixtures; legacy pure workflow helpers remain pending consolidation, but main screens do not call their simulated mutations. adapters.ts defines provisional async operations and unavailable Forge operations. schemas.ts validates evidence, scenario comparisons, projects and capability payloads. useResource.ts ignores obsolete responses after dependency changes/unmount. Graph.tsx lazily loads React Flow and offers a keyboard-accessible list alternative. ActionReview.tsx handles selected actions and explicit backend confirmations. PassportView.tsx validates reports and exports the displayed client payload. ConfirmDialog.tsx handles modal keyboard focus and restoration. ErrorBoundary.tsx provides reload/navigation recovery for render failures.

The local workflow lives in memory and resets on page reload. Theme preference alone persists in localStorage. Fictional evidence references describe authored fixtures, not verified source files. Fixture approval requests are rejected as requiring a live backend. No simulated approval/execution success remains in the main UI; unknown support usage remains unknown. All render text uses React escaping; no raw HTML rendering is used. Demo mode never calls Jira/Confluence and requires no secrets.

## Integration and ownership

EXPERIENCE owns static/hello-world and frontend documentation; CORE owns backend, manifest and deployments. Keep existing registration unchanged. Replace provisional contracts after agreement with CORE. See integration/FORGE_HANDOFF.md and integration/GITHUB_HANDOFF.md. Forge mode fails explicitly until those contracts exist. Browser demo results do not prove live Forge compatibility, CSP compatibility or actual authorization.

## Limitations and source preservation

The template's original App.jsx is preserved but unused; index.jsx loads App.tsx only in development and ForgeApp.tsx for production. Do not restore the template's automatic bridge call into demo startup. No AI inference or backend simulation runs. Scenarios are authored fixtures, and custom parameters are unavailable. Dependency audits include the retained bridge; review actual reports before integration. The current work has no remote push or PR. See STATUS.md for remaining verification and known limitations.

## V2 production boundary

npm start serves the development-only fixture prototype on port 3000. npm run build produces the Forge production access/capability interface, which has no fixture fallback. npm run preview -- --host 127.0.0.1 --port 3001 previews that build locally; it intentionally reports PENDING_BACKEND until reviewed CORE resolver bindings are configured. npm run test:browser builds first and tests both development and production servers. Host theming is implemented but requires Forge-hosted verification. See coordination/frontend-integration-requests.md for the exact backend dependency list.

