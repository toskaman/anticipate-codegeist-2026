# Reflow and deployment candidate readiness — 2026-11-02

The owner authorized both continued frontend work and a request to CORE for a development deployment. EXPERIENCE does not deploy, register or create a Forge app. The previous deferral is superseded for the exact candidate requested after its CI passes; production remains outside this authorization.

## Reproduced and fixed

A 500-character node label caused document horizontal overflow at 320 CSS pixels. After wrapping fixes, the stress test exposed overlapping canvas nodes. The final canvas uses a three-line visual preview with a separate visible status, while retaining the full label in the DOM, accessible name, title, textual list and details. Full graph data/export is unchanged.

Headings, buttons, summaries and header badges wrap within the available width. Exact action payloads remain complete in a bounded scroll region, with a named region and keyboard focus. End scrolls its content without creating a page tens of thousands of pixels tall. The tests review 200-character action IDs, 1,000-character reasons, 500-character verification text and a 29,914-character payload text.

Responsive graph paging now keeps the selected node visible across desktop/mobile sizes (20 to 6 nodes and back). The viewport refits when page size changes rather than silently selecting a different first node. Full filtering/payload semantics still come from CORE 0.2.0; no backend or contract changes.

## Evidence and limits

42 frontend unit tests and 51 browser tests passed. TypeScript, ESLint, formatting and production build passed. The suite retains 42 CORE and 42 prototype screen/theme/viewport combinations and adds three reflow/selection cases. Tests use controlled transport and never execute real Jira actions. Raw snapshots and build hashes: evidence/experience/core-reflow/.

The zoom case uses CSS root zoom 2 at a 1280px viewport. This is a reflow stress emulation, not a claim of native browser zoom or assistive-technology certification. Native 320px capture is also tested. The test harness keeps MOCK TRANSPORT labeling visible while scrolling; it is excluded from the production build. Four viewport stress PNGs and 42 full-page connected-screen captures are genuine Chromium screenshots.

An earlier full run logged two ReactFlow #004 dimension warnings in the legacy prototype graph transition; final reruns passed. No peak-memory, long-soak, hosted performance, zero-warning or security certification is claimed. Existing advisory/license release work remains documented in CORE_CLIENT_INTEGRATION.md.

## Deployment relay

The exact source candidate and development request will be recorded in docs/coordination/DEPLOYMENT_REQUEST_EXPERIENCE.md and status-experience.json after publication and green candidate CI. CORE must use the existing app/installation and only the owner's approved Forge identity, never a colleague's token. No secret is included in repository coordination files. If access is unavailable, CORE must report the blocker instead of registering an app or changing identity.

Hosted user-context acceptance remains separate. Native browser control in this session still fails during startup with CryptUnprotectData; no authenticated browser or Jira outcome is inferred from local tests. Deployment is a CORE action; real Jira writes require review of their exact targets and actions.
