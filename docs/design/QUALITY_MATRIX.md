# Screen quality matrix

Baseline `main` 59d88fa (PR #25, dark default) plus this branch, 2 Nov 2026. "Local" = Chromium Playwright with MOCK_TRANSPORT. "Hosted" = CORE's LIVE_FORGE reports in `docs/evidence/EVIDENCE_PACK.md` and the handoff. Automated accessibility = axe WCAG 2.0–2.2 A/AA tags; not a certification. Firefox/WebKit: not run in this pass (browsers unavailable in this environment); last run recorded in `UI_RELEASE_READINESS.md`.

| Screen | Function | Readability | Accessibility | Performance | Errors handled | Proof | Real status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mission Control | Project/issue selection, guided demo, sample preview → confirm → result, recovery by plan ID | Single highlighted next step at each stage; sample statuses as labelled badges | axe light/dark, keyboard focus to next control, 320 px reflow | Parallel startup reads; first content ~3.3 s cold / 51 ms warm on hosted dev (CORE, before parallel reads) | No projects (with permission guidance), permission denied, timeout/CONFLICT → read-only re-check, partial creation | Local tests; hosted sample creation and judge install (CORE) | Hosted-verified flow; this pass's wording changes local only |
| Evidence Graph | Map, evidence sources strip, inspector, search/filters, accessible list | Readable zoom on mobile; bounded windows for large graphs | Keyboard-selectable nodes and list equivalent; axe | Lazy-loaded graph chunk; 1,000-node performance capture | Truncation and access-limited evidence shown | Local; hosted graph on real Jira (CORE) | Hosted-verified |
| Scenario Lab | Retire/decommission and upgrade comparisons, named open questions | Verdict badges with icon + text; direct vs indirect explained | Native radio groups; axe | Comparison call timed in Settings | Expired snapshot, missing replacement, upgrade not advertised; option C labelled as a simulation assumption | Local; hosted upgrade comparison (CORE R1) | Hosted-verified |
| Decision Firewall | Reason chains, remaining uncertainty, validator distinction | Plain-language verdict and next safe step | axe; forced-colors capture | — | Writes unavailable, evidence-changed notice | Local; hosted policy verdicts (CORE) | Hosted-verified |
| Prevention Plan | Review, approve, execute, verify, recover | Approve vs execute visually separate; PARTIAL/Completed show the unverified or unapproved gap | Dialog focus trap, Escape, focus return | — | Evidence changed (persists after reload), lost response, partial, failed, permission | Local; hosted 6/6 verified writes and drift refusal (CORE) | Hosted-verified; partial approval ends in PARTIAL since CORE P0 fix (#26, hosted proof AVT-3), shown as "Approved actions verified · n not approved" |
| Prevention Passport | Record, "In short" summary, transition gate row, historical badge, JSON export, A4 print | Grouped approvals; retention line; gap listed in limitations | axe; print palette forced light | Render with 40 actions tested | Expired/archived snapshot, missing records | Local print PDFs; hosted dev print (CORE) found 2 defects, fixed in #23 | Re-print on hosted after #23 still to confirm |
| Settings | Capability truth table, validator outage policy (admin switch, read-only otherwise), Rovo/MCP guide, display preferences, session timings | Three-column "in app / backend / verified" | Segmented radios, axe | Session timings export | Backend reports per capability | Local; hosted R2 capabilities (CORE) | Hosted-verified |

## Not covered yet

- Firefox and WebKit in this pass; native screen reader; native browser zoom at 200 %/400 % (CSS reflow tests only).
- Hosted re-measurement of startup after the parallel reads; hosted re-print after PR #23; hosted CONFLICT path.
- Long-session memory and stability soak.
