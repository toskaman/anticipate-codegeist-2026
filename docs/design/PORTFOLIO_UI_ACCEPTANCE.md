# Several changes at once — ORP-32 (#142)

4 November 2026. Baseline `main` 4d937b6, including CORE #141/#144/#145/#146. This is a read-only Scenario Lab workflow, separate from the single-change decision, plan and approvals. Deployment/hosted verification belong to Muse. No local fixture proves a real Jira result.

## Contract and interaction

- The panel and its lazy-loaded module are reached only when `portfolioSimulation === "AVAILABLE"` **and** `operations` includes `simulatePortfolio`. Absent/unsupported capabilities leave the existing journey intact. No locally invented flag or shared-role switch.
- Add at most `PORTFOLIO_LIMITS.maxChanges` (10) named changes, one operation per row: remove, retain temporarily, breaking/declared-compatible upgrade, or migrate USES/DEPENDS_ON consumers to a different loaded record. Both endpoints come from the analysed snapshot, never a free-text ID. CORE still decides whether they are readable and valid.
- Row order is the proposed order, changed with labelled earlier/later buttons. Adding focuses the name; removing returns focus to Add change. Names are bounded to 200 characters. Missing/invalid fields disable simulation.
- Submit `SimulatePortfolioRequest` through the existing validating ForgeClient with the current snapshot/project/root/source and proposed order. The result is rejected if nested evidence or requested change identities do not match. No approval, execution, sample creation or Jira write operation is used.
- Editing/reordering/deleting clears the old result. Pending inputs are disabled. Snapshot/root changes remount the editor and abort pending work, so a late response cannot populate a different review. Expired snapshots block a new run and label existing results historical.
- Show the server's shared records and weakest supplied impact status, conflict reasons, suggested ordering or cycles, proposed-order violations, evidence gaps, per-change verdict explanations and result hash. Snapshot time/reuse/coverage are visible. Missing names stay as IDs; missing impact evidence defaults to Unknown. Lists show at most 20 entries and disclose omissions.
- A compatible order, migration assumption or passing verdict is not a completed migration, authorization or prediction. The hash identifies a result and is not presented as a cryptographic certificate. Results do not update the selected single-change decision or generate a plan.
- VALIDATION/BUDGET_EXCEEDED/permission/expiry errors retain the backend code/message/request ID, clear stale results and require explicit retry or fresh analysis. Portfolio timeouts describe a read-only request, without execution-recovery instructions.

Authoritative contracts: `packages/contracts/src/index.ts`. CORE semantics: [PORTFOLIO_SIMULATOR.md](../design-core/PORTFOLIO_SIMULATOR.md). The older capability-object wording there differs from the actual CapabilityState string; correction requested on #130 comment6619037626. No CORE file/contract was edited by EXPERIENCE.

## Local validation

The delivering PR records exact completed results. Unit cases cover loaded endpoints, migration self-target, ten-change bound, unique identities, name bounds, operation assumptions and pending-response isolation using the real ForgeClient/component. Browser cases use the labelled MOCK_TRANSPORT harness and reject unexpected operations. They cover absent/unsupported/missing-operation gates, named consequences, errors, cycles, nested snapshot mismatch, keyboard focus, ten changes, editing/result clearing, light/dark axe and 320/390/768/1024/1440/1920/3440 reflow. Full frontend regression, build, typecheck, lint and formatting are required before handoff.

## Ten internal review perspectives — not human research

| Perspective | Concrete decision |
| --- | --- |
| New juror | Call it “Several changes at once”; start empty, describe what Add change does. |
| Product designer | Keep portfolio output separate from existing scenario cards and approvals. |
| Jira administrator | Reuse the owned snapshot; preserve backend refusal and permission boundaries. |
| CTO | Show conflict reason and how another change altered the verdict, not just counts. |
| Enterprise buyer | Do not imply shared approvals or continuous monitoring are available. |
| Accessibility | Native labelled controls, explicit row order, stable focus after add/remove, status/error regions. |
| Performance | Load the module only behind the real capability; ten inputs and bounded output lists. |
| Security | Reject cross-snapshot/change responses; abort on context change; no write operations. |
| Nontechnical reviewer | Label compatibility/migration as assumptions; an order is not a release queue. |
| Commercial reviewer | No prices, savings, likelihood percentages or customer outcomes inferred. |

## Hosted acceptance — Muse, pending

- [ ] Record site, deployed build/commit, UTC timestamp, account role and project. Confirm capability/operation are advertised on that build; older builds show no panel.
- [ ] On a permitted real project, analyze a root with multiple readable nodes. Add two named changes and inspect shared consumers, status/source context, conflict reason, order/cycle, gaps and per-change explanations. Record snapshot ID/hash and actual expected/observed outcome, not merely a “done” comment.
- [ ] Repeat identical input on the **same reused snapshot** and verify the same hash. Fresh snapshots may legitimately yield a different identity.
- [ ] Verify Jira issues/links were unchanged and no approval/execution was created. Retain relevant redacted resolver/log or before/after evidence. Comparing alternatives must not perform a migration.
- [ ] Use an unreadable/missing target or inaccessible snapshot in an authorized CORE acceptance experiment; confirm permission-safe refusal. Do not reveal whether a hidden issue exists. UI selectors alone are not the authorization proof.
- [ ] Verify ten-change limit, 320 px layout and keyboard controls on the hosted frontend. Record actual server validation/budget errors if encountered; do not fabricate them for a screenshot.
- [ ] Recheck #126 dated-sample/slip and #140 UI/refusal acceptance separately. Shared execution/two-account gate and radar remain outside this delivery.
