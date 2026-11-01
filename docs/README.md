# Local frontend developer guide

## Prerequisites and startup

Use Node 24 LTS, at least 24.0 (the installed development machine uses 26.7.0). From the repository root, enter static/hello-world and run npm ci, then npm start -- --host 127.0.0.1. Open http://127.0.0.1:3000. No credentials or separate backend are required. Build with npm run build; static assets are emitted to static/hello-world/build with relative URLs, matching the existing manifest resource. Do not modify manifest.yml for local development.

## Repeatable checks

Run npm run typecheck, npm run lint, npm run format:check, npm test, npm run test:browser and npm run build from static/hello-world. On first browser setup run npx playwright install chromium. npm run format applies the repository formatter. Browser results go to test-results; screenshots go to the repository evidence folder. Browser tests use the running local server when available. Component Showcase appears in development navigation only and has reproducible empty/error/loading previews.

## Architecture and trust

App.tsx composes screens and local state. domain.ts holds temporary frontend types, deterministic fixtures and the pure workflow transition. adapters.ts defines provisional async operations and unavailable Forge operations. schemas.ts validates evidence, scenario comparisons, projects and capability payloads. useResource.ts ignores obsolete responses after dependency changes/unmount. Graph.tsx lazily loads React Flow and offers a keyboard-accessible list alternative. ConfirmDialog.tsx handles modal keyboard focus and restoration. ErrorBoundary.tsx provides reload/navigation recovery for render failures.

The local workflow lives in memory and resets on page reload. Theme preference alone persists in localStorage. Fictional evidence references describe authored fixtures, not verified source files. A local approval is not server authorization. Unknown support usage remains unknown after simulated execution. All render text uses React escaping; no raw HTML rendering is used. Demo mode never calls Jira/Confluence and requires no secrets.

## Integration and ownership

EXPERIENCE owns static/hello-world and frontend documentation; CORE owns backend, manifest and deployments. Keep existing registration unchanged. Replace provisional contracts after agreement with CORE. See integration/FORGE_HANDOFF.md and integration/GITHUB_HANDOFF.md. Forge mode fails explicitly until those contracts exist. Browser demo results do not prove live Forge compatibility, CSP compatibility or actual authorization.

## Limitations and source preservation

The template's original App.jsx is preserved but unused; index.jsx explicitly imports App.tsx. Do not restore the template's automatic bridge call into demo startup. No AI inference or backend simulation runs. Scenarios are authored fixtures, and custom parameters are unavailable. Dependency audits include the retained bridge; review actual reports before integration. The current work has no remote push or PR. See STATUS.md for remaining verification and known limitations.
