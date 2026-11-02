# EXPERIENCE response: changed evidence and confirmed Jira sample preparation

Implemented from `CORE_TO_EXPERIENCE_HANDOFF.md` at CORE `f2c19f1` on 2026-11-02. Contract version remains 0.2.0. No EXPERIENCE-authored backend, manifest, shared-contract or Forge identity changes.

## Delivered behavior

- `ForgeClient` retains the server error code, message, request correlation and structured details. The screen renders added/removed relations as `from KIND to [STATUS]`, and evidence that became unknown.
- Approval/execution refusal sets the local plan to the server's `EVIDENCE_CHANGED` state. The explanation persists after error dismissal and read-only audit refresh. Approval/execution remain disabled; the ambiguous outstanding-mutation message is suppressed for this refusal. Rebuild snapshot returns to Mission Control and requires a new snapshot/comparison/plan. It never retries the refused plan.
- Shared schemas now accept `EVIDENCE_CHANGED` in plan/Passport reads. Recovery after reload, visible Passport status and JSON export retain that exact status. A recovered plan uses the server audit reason when supplied; no error diff is invented when reads do not contain it.
- Optional capability-gated **Check evidence freshness** invokes `checkPlanFreshness`. A changed read blocks the UI without pretending that the read changed the stored server plan status. Freshness is an observation at the reported time, not authorization or a guarantee about a later write.
- Mission Control has **Prepare a demo project**. It previews sample data in a selected existing Jira project, displays backend item/link states and missing permissions, then requires a separate confirmation for `createSampleProject({ projectKey, confirm: true })`. Nothing is created by opening the panel, previewing, navigating or approving a prevention plan.
- The screen explicitly identifies real labelled Jira sample tickets, not local fixtures or a newly created Jira project. Empty sites without an accessible project receive setup/access guidance. Results include partial failures. After a lost creation response, a fresh preview is required before another manual creation attempt; no automatic retry occurs.
- **Analyze <root>** captures a real Jira snapshot for the reported root. The replacement is preselected for scenario C only if it is present in that snapshot. Project/root changes clear the sample replacement preference. There is no automatic prevention-plan approval or execution.

## Verification

- Frontend: **44 unit tests**, **59 browser tests (44.8 s)**, TypeScript, ESLint, formatting and production build pass.
- CORE baseline: **31 tests**, contracts **3**, simulation **8**, root TypeScript pass.
- Two final targeted browser checks additionally verify blocked Passport JSON export and successful recovery after reload (2/2 pass, 6.7 s).
- Regression coverage includes refusal at approval and execution; dismiss/refresh/reload cannot unlock the old plan; changed freshness; sample preview/confirmation/cancel; no accessible projects; missing permissions; partial creation; timeout; sample root/replacement analysis. The existing seven-screen/two-theme/three-viewport matrices remain covered.
- axe-tagged accessibility and document-width checks pass on refusal at 320px/1440px and sample results at 390px. Native mobile captures were visually inspected. This is not exhaustive accessibility certification.

## Evidence index

All are genuine local Chromium captures with **MOCK TRANSPORT** banners. They are not hosted Atlassian evidence and performed no real Jira writes.

| Capture | Viewport | State |
| --- | --- | --- |
| [approvePlan-MOCK.png](../../evidence/experience/continuous-safety/approvePlan-MOCK.png) | 320 × 900 | Approval refused, reason/diff retained after refresh |
| [executeApprovedPlan-MOCK.png](../../evidence/experience/continuous-safety/executeApprovedPlan-MOCK.png) | 1440 × 900 | Execution refused, old plan blocked |
| [sample-result-MOCK-390.png](../../evidence/experience/continuous-safety/sample-result-MOCK-390.png) | 390 × 844 | Explicit sample confirmation and reported result |

## Handoff and limits

CORE owns deployment and authenticated hosted acceptance. No Forge deployment or real Jira sample creation was performed by EXPERIENCE. CORE's handoff reports the backend features in development 4.12.0/4.13.0; this does not establish deployment of this frontend.

No accessible Jira project means this setup cannot create a project: the backend creates sample tickets in an existing project only. The UI renders relation labels supplied by CORE; sample links currently use the contract's `blocks` label, while backend creation also contains a `Relates` replacement relation. CORE should reconcile that descriptive mismatch separately. No frontend relationship is fabricated to compensate.

The newer CORE `fc89faa` Teamwork Graph/retention work was discovered during implementation but is outside this feature handoff and is not silently included. Dependency/license findings remain documented. Other local output/handoff folders were left untouched and are excluded from this change.
