# UI v3 release readiness

Branch: `feat/product-experience`, based on `e4f32352a5b4bf5eb49ad49cd96adbe89599fbf6`.
Commit SHA, push and CI results are recorded in the pull request, not here.

## What was run in the authoring environment

npm registry access was unavailable there, so the standard toolchain could not be installed. The
following substitutes were used. **They do not replace the commands in the next section.**

| Check | Result | Notes |
| --- | --- | --- |
| Playwright browser tests, `tests/core-*.spec.ts` (37 tests: integration 14, pagination 7, reflow 3, visual 13 incl. keyboard and dialog focus) | 37 passed, Chromium | Bundle built with esbuild + React 19 + React Flow source. |
| axe assertions inside `core-integration.spec.ts` | **NOT RUN** | `@axe-core/playwright` replaced by a stub that records "skipped". No accessibility pass is claimed. |
| TypeScript (strict) on hosted sources | 0 errors in repository files | React 18 types from DefinitelyTyped; dependency sources excluded. |
| `src/features/graph/layout.test.ts` (new) | 3 passed | Executed through a minimal vitest-compatible shim, not vitest. |
| `src/CoreWorkspace.test.ts` | 1 passed | Same shim. Import now points at `src/app/workflow.ts`. |
| Vite production build, vitest, ESLint, Prettier, bundle size | **NOT RUN** | |
| Firefox, WebKit | **NOT RUN** | |
| Hosted Forge (LIVE_FORGE) | **NOT RUN** | CORE owns deployment. |
| Prototype specs (`journey`, `screens`, `accessibility`, …) | **NOT RUN** | Prototype files are unchanged. |

## Required before merge (run on a machine with npm)

```powershell
cd static/hello-world
npm ci
npm run typecheck
npm run lint
npm run format:check      # run `npm run format` first if only new files differ
npm test
npm run build
npx playwright install chromium   # only if browsers are missing
npx playwright test
cd ../..
npm ci; npm run typecheck; npm test
```

Record actual results, failures and fixes in the pull request.

## Integration notes

- No change to `manifest.yml`, `src/`, `packages/`, Forge identity, permissions or deployment.
- Entry point unchanged: `ForgeApp.tsx` → `CoreWorkspace`; it now imports
  `src/styles/anticipate.css` instead of `src/style.css` (still used by the prototype).
- `CoreEvidenceGraph.tsx` removed; replaced by `src/features/graph/EvidenceGraph.tsx`, lazily loaded.
- No new runtime dependency.

## Known risks

- Rendering differences between the authoring bundle and Vite/React 18 are possible but not
  expected to affect behaviour; regenerate screenshots with the real toolchain.
- Test label updates are listed in `UI_REDESIGN_AUDIT.md`; behavioural assertions (call counts,
  disabled states, idempotency, recovery) are unchanged.
- `:has()` is used for checkbox styling; browsers without it fall back to a plain checkbox.
