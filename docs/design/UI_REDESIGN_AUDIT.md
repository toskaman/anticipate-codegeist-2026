# UI redesign v3 — audit and decisions

Scope: the **hosted Forge frontend** (`static/hello-world/src/ForgeApp.tsx` → `CoreWorkspace`).
The local authored prototype (`App.tsx`, `Graph.tsx`, `ActionReview.tsx`, `PassportView.tsx`,
`style.css`) is untouched and still serves the Vite-only demo.

## Baseline (before, `feat/product-experience` @ `e4f3235`)

Evidence: `evidence/experience/core-integration/*-transport-*.png` (historical, preserved).

| Area | Baseline issue |
| --- | --- |
| Architecture | `CoreWorkspace.tsx` held 1,307 lines of state, CORE calls and markup for all 7 screens. |
| Rendering | A 1 s `setInterval` re-rendered the whole workspace every second, only to evaluate snapshot expiry. |
| Graph | Nodes placed on a fixed grid (4 columns); edges crossed nodes; labels overlapped (`DS_ON · UNK`); root not distinguished; no causal path view; React Flow imported eagerly on first paint. |
| Hierarchy | Every screen repeated the same eyebrow + tagline; panels were text paragraphs (`Plan hash: … · status …`); raw IDs and hashes dominated card bodies. |
| Terminology | "Read evidence snapshot", "Run CORE comparison", "CORE verdict", "Backend-approved action IDs". |
| Navigation | Flat list of 7 buttons; no progress, no stage state, no current-decision context. |
| Safety UX | Approve and Execute were adjacent buttons with similar weight; generic "Confirm" dialog text. |
| Passport | A sequence of `<p>` lines; no tables, no print layout beyond browser default. |
| Settings | Raw `key: VALUE` dump; no distinction between supported / configured / verified. |
| Styling | One global stylesheet shared with the prototype; element selectors (`button`, `aside`, `main`) with no tokens beyond 7 colours. |

Targets set: one journey with backend-derived stage state; each screen answers *what / why / next*;
graph readable at 1440 px with a causal path view; no workspace-wide timer; Approve and Execute
visually and verbally distinct; no horizontal overflow from 320 px to 3440 px; all existing
safety tests still passing.

## Decisions

- **Logic moved, not changed.** `src/app/useCoreWorkflow.ts` contains the previous request order,
  validations, idempotency keys, `sessionStorage` recovery markers and all guards
  (`canExecute` is the same expression). `src/app/workflow.ts` holds `simulationRequest`,
  storage helpers and export unchanged. No CORE contract, backend, manifest or Forge identity
  file was edited.
- **Expiry without polling.** `useExpired` schedules one timeout at `expiresAt` (re-armed for
  distant dates beyond the `setTimeout` limit). The countdown chip is an isolated component that
  ticks every 30 s.
- **Journey navigation.** Six numbered stages + Settings. Stage state comes only from backend
  artefacts (`snapshot`, `comparison`, `plan`, `records`, `passport`), never from page visits.
- **Graph.** Layered layout by hop distance from the change (undirected BFS — used for placement
  only and labelled "not impact"); tall lanes wrap at 6 rows; height follows the measured aspect
  ratio. Highlighted paths use only `SimulationResult.impacts[].pathEdgeIds`; missing edges render
  as "not in the loaded snapshot". An overlay switch shows any option's impacts without changing the
  selected decision. React Flow is lazy-loaded with the Evidence Graph page.
- **Scenario cards** as a radio group; hashes moved to Technical details; the suggestion banner
  states that a suggestion is not an approval; PASS copy says it does not mean safe.
- **Decision Firewall** builds a 4-step chain per violation (change → affected records → policy
  explanation → review step) from the returned `nodeIds` and `explanation`; review-step text is
  generic guidance keyed by severity, labelled as such.
- **Prevention Plan** separates Review / Approve / Execute / Verify; the Execute panel and dialog use
  the danger treatment; each action shows a lifecycle derived from backend records
  (`Outcome uncertain` when execution was requested but no record returned).
- **Passport** is a numbered report with tables and a print stylesheet; evidence counts are shown
  only when the matching snapshot is loaded.
- **Settings** separates *In this app* / *Backend reports* / *Verified here*.
- **No new runtime dependency.** Inline SVG icons; system font stacks; one scoped stylesheet
  (`src/styles/anticipate.css`).

## Label changes (tests updated accordingly, behaviour assertions unchanged)

| Before | After |
| --- | --- |
| Read evidence snapshot | Analyze dependencies |
| Root Jira issue key | Jira issue key |
| Compare change scenarios / Run CORE comparison | Compare options |
| Replacement node for scenario C | Replacement for option C |
| Selected CORE scenario (select) | Decision options (radio group) |
| Review CORE policy checks | Check safeguards |
| Generate selected scenario plan | Generate prevention plan |
| Execute backend-approved Jira actions | Execute approved actions |
| Confirm (approve / execute) | Record approval / Execute in Jira |
| Refresh plan status and audit | Check execution status |
| Open CORE Prevention Passport | Open Prevention Passport |
| Export CORE Passport JSON | Export Passport JSON |
| Snapshot evidence (heading) | Dependency map |

Graph window sizes changed from 6/12/20 to 8/20/36 records (mobile/tablet/desktop) because the new
layout stays readable at that size; `core-reflow.spec.ts` expectations were updated to match.

## Remaining limitations

See `docs/design/UI_RELEASE_READINESS.md` — notably: no Vite build, vitest, ESLint, Prettier or axe
run in the authoring environment, and no hosted Forge verification.

## Internal review (not a prediction of official scores)

| Perspective | Score | Evidence | Remaining weakness |
| --- | --- | --- | --- |
| Visual excellence | 8/10 | Visual set `11-prevention-passport-*`, `04-…causal-path-*` | Graph labels small on 4-lane graphs at 1440 px. |
| Product simplicity | 8/10 | Every screen has step, lead and one primary next action | Mission Control form still has three inputs before the first result. |
| Engineering credibility | 9/10 | Paths only from `pathEdgeIds`; stage state only from backend artefacts; safety specs unchanged and passing | No hosted run. |
| Accessibility | 6/10 | Keyboard graph alternative, focus-trapped dialogs, forced-colours capture, reduced motion | axe not executed; no screen-reader session. |
| Codegeist presentation | 8/10 | Seven-step recording plan in `docs/jury/JURY_UI_SHOWCASE.md` | Needs a real-installation recording. |
