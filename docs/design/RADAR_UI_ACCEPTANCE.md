# Decision Radar attention — ORP-33 (#147)

4 November 2026 · baseline `main` c5040ae, with #146 and #148 merged. Contract: `PlanAttention` / `getPlanAttention` in `packages/contracts/src/index.ts`. CORE semantics and limits: [DECISION_RADAR.md](../design-core/DECISION_RADAR.md). This is a read-only display of stored event hints, not a browser subscription, freshness verdict or authority to execute.

## Implemented behaviour

- Advertised `getPlanAttention` is required. Unsupported backends show no panel or request; the module is lazy-loaded behind that signal.
- Plan and Passport read their own `planId`. Pending requests are aborted on context change; a delayed previous-plan response cannot populate the new panel. Failed reads clear the display and expose the real backend error; retries are explicit.
- ACTIVE says **Listening**, explicitly as a backend-reported state with possible event delay. DEGRADED lists plain-language reasons and coverage gaps. NOT_CONFIGURED says **Radar not available for this plan**, with supplied reasons. No state uses a green badge or “all clear”.
- Preserve `note` verbatim, observation time or an explicit missing-time label, indexed/unindexed coverage, event type/link type/occurred/observed times, and `truncated`. The schema bounds each response to 50 facts; truncation warns that more exist. Empty hints never prove freshness.
- **Re-check evidence** calls the existing workflow `checkFreshness` action, not a parallel direct RPC. Its evidence-change handling still blocks approvals/execution. Then reload `getPlanAttention`; never clear hints locally or synthesize a successful freshness result. Failed freshness checks retain unresolved backend hints and the workflow error.
- Re-check is unavailable for another/unrecovered plan, unavailable freshness operation, expired snapshot, already blocked decision or busy workflow. This does not replace server authorization. Reading radar remains possible independently.
- Passport attention is labelled current and separate from its recorded contents. It sits outside `.ax-report`, is hidden in print and does not enter Passport JSON/export. A report without a plan ID gets no fabricated radar identity.

## Validation scope

The delivering PR records completed local totals and source-labelled captures. The real component/ForgeClient unit test covers loading and late-response isolation. Eight browser cases cover both themes, keyboard re-check and exact RPC sequence, fresh and changed evidence, approval/execution guards, failed checks, unavailable/empty/degraded monitoring, truncated events, explicit retry, unsupported backend, seven viewport widths, scoped axe and Passport print separation. These are authored MOCK_TRANSPORT observations. Native screen readers, human comprehension and hosted event latency are not established.

## Internal review — ten perspectives, not ten participants

| Perspective | Decision |
| --- | --- |
| First-time juror | Say what the hint means and offer one evidence re-check; no unexplained health score. |
| Product designer | Keep attention distinct from the plan verdict and the historical Passport. |
| Jira administrator | Explain missing index/degraded coverage; no pretend configuration switch. |
| CTO | Missing alerts do not prove absence of a dependency change. |
| Enterprise buyer | No continuous-delivery or shared-approval claim from a stored event list. |
| Accessibility | Native buttons, polite loading status, visible errors, focus restored after re-check/retry, keyboard path and reflow. |
| Performance | Lazy module; one read per opening/explicit refresh; response bounded by schema. |
| Security | Use existing freshness guards and backend ownership checks, never local role decisions. |
| Nontechnical reviewer | “Listening” is qualified; note and incomplete-event warnings remain visible. |
| Commercial reviewer | No incident-prevention rate, latency guarantee or customer result invented. |

## Hosted acceptance — Muse, pending

- [ ] Record site, deployed build/commit, UTC timestamp, permitted account role and plan ID. Verify the advertised operation and actual monitoring/coverage response.
- [ ] On an authorized disposable dataset, create/delete a relevant issue link or delete an issue. Confirm the real Forge event payload is handled and the expected plan receives a hint. Record occurred/observed/UI timestamps and actual gaps/delays; do not substitute authored fixtures.
- [ ] Re-check evidence from the panel. Confirm `checkPlanFreshness` then attention reload. Fresh evidence may clear hints; actual drift must retain the refusal and keep approval/execution blocked. No approval or Jira execution should be sent by the panel.
- [ ] Test backend ownership/access refusal with another authorized account; the UI gate is not permission evidence. Record actual/expected result without leaking hidden issue details.
- [ ] Observe/configure a genuine degraded/unavailable condition if safely supported by CORE; otherwise leave that hosted case pending. Never manufacture a LIVE_FORGE screenshot.
- [ ] Check light/dark, keyboard, 320 px, retry, current Passport labelling and print/export separation on the installed app. Restore any disposable data modified during the authorized experiment.

No Forge registration/deployment, Jira mutation, role switch or event-handler change is performed by this frontend delivery. Shared activation/two-account acceptance, portfolio #148, earlier #140 and dated-slip #126 hosted checks retain their separate owners and evidence gates.
