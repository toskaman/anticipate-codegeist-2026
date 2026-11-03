# Product experience reconciliation — 4 November 2026

Scope: Orpheane's autonomous experience/product brief. This is an implementation audit, not user research, a launch claim or a hosted acceptance report. Working baseline: `main` 39ccc3f, including merged ORP-30 #126 and CORE #129. Keep the existing teal, evidence-first design system; no replacement theme, fonts, graph engine or animations is justified by the observed gaps.

## Decisions and delivery

| Brief area | Current evidence and disposition |
| --- | --- |
| 0–3: ownership, reconciliation, operating model | AGENTS.md, CLAUDE.md, README, STATUS, RELEASE, current design/quality/enterprise docs, submission pack and GitHub queue checked. #126 implements #121 and is merged with green CI; do not repeat it. Versions/deployments and CORE state stay with Muse. |
| 4: first impression | Mission Control retained its primary guided-demo CTA, project selection and capability/error states. Concrete indirect-dependency copy and read/write boundaries replace the vague promise. Demo focus honors OS and viewer reduced motion. Issue #127. |
| 5: signature journey | Existing real hook guards, EvidenceChangeNotice, explicit approval/execution and Passport retained. No staged “yesterday” event or fabricated drift. `useCoreWorkflow.guards.test.ts`, `core-integration.spec.ts`, PR #110. Hosted drift proof remains in EVIDENCE_PACK. |
| 6: graph | Existing bounded, lazy map, evidence states, references, accessible list and impact-path inspector retained. New focus mode uses only backend-supplied impact edges and loaded endpoints; missing/omitted context is disclosed. Issue #133. |
| 7: Scenario Lab | Pairwise inspector names differing/shared supplied records and unique triggered rule IDs, preserves weaker evidence and migration assumptions, never changes decision selection or sends requests. Long lists are bounded; absent records are not called safe. Issue #127. |
| 8–10: portfolio, shared decisions, radar | Design/contract handoffs #130, #131, #132. Pure portfolio engine and workspace fixes in Muse's #129 are not a Forge capability. No production controls, synthetic monitoring or client-only permissions. See ENTERPRISE_FUTURE_VIEWS.md. |
| 11: Passport | Executive “In short”, chosen option, recorded approvals, verified execution receipts, gate state, open questions, timestamps, history/retention labels, JSON and A4 already exist. Existing connected long-report/print/axe tests retained. No cosmetic rewrite without a failing case. |
| 12: design system | Existing DESIGN_SYSTEM_V3 tokens and components reused for new panels, semantic badges, labels, focus and reflow. No decorative metrics or entry animation added. |
| 13: judge flow | ORP-30 preview/create dates, permission guard, no existing-date overwrite, idempotency and slip regression are in #126. Hosted deployment/clean-project verification remains pending with Muse. Existing no-hidden-write and timeout/recovery tests retained. |
| 14–16: buyer, competition, measurable value | BUYER_HYPOTHESES.md, ORP-31 (#136) and VALUE_STUDY_PROTOCOL.md separate desk research, commercial hypotheses, local measurements, hosted evidence and unperformed human trials. No ROI/customer statistics invented. |
| 17–18: accessibility, responsiveness, performance | New pair inspector covers keyboard and 320/390/768/1024/1440/1920/3440 reflow in light/dark, axe and no additional resolver calls. Focus map has bounded records/edges. Existing print/large-graph tests remain. Native screen reader and real browser zoom remain unverified. |
| 19: presentation | DRIFT_CAPTURE_PLAN.md adds English narration/caption text, a first-three-minute drift storyboard and screenshot/proof checklist (#139); the original validator setup/reset instructions remain. All are preparation only. Final recording and publication remain with owner and deferred; new brief authorizes planning, not automatic publishing. No capture can be called LIVE_FORGE unless source/site/date are recorded. |
| 20: GitHub presentation | README keeps a short value story, install path, labelled screenshots and limitations. Test counts should point to RELEASE rather than be copied into another mutable claim. No invented commercial email or customer endorsement. |
| 21–26: coordination and done | Backend requests use GitHub and enforce server authority. PRs, CI and Muse review/merge remain required. A local implementation is not done until its review gate is satisfied; hosted checks are explicitly pending. |

## Critical review: concrete decisions

These are ten internal review perspectives, **not ten people or human usability results**.

| Perspective | Finding / correction |
| --- | --- |
| First-time juror | Name indirect dependencies and distinguish analysis from writes before asking the user to create sample data. Keep the guided demo as the primary CTA. |
| Product designer | Pair inspection initially displaced decision cards. Move it after those cards, keeping the decision choice first. |
| Jira administrator | Dated samples require Schedule Issues and a Due date create-screen field; preview must explain that and old samples must not be rewritten. |
| CTO | Show which supplied records differ, not just a count; a PASS and an absent impact are not incident-safety guarantees. |
| Enterprise buyer | Governance is not unique: competing products advertise approvals and decision records. Sell a demonstrable workflow, not an exclusivity claim. |
| Accessibility specialist | Fix unconditional smooth demo scrolling; use native labelled selects, keyboard navigation and text-plus-icon evidence statuses. Native AT remains a separate check. |
| Performance engineer | Pair lists show six records per group; focused map caps records and relationships. Comparison inspection has no network request or new dependency. |
| Security engineer | Inspector accepts only supplied results, cannot approve/execute, rejects different snapshots and does not borrow labels from unrelated evidence. |
| Nontechnical decision-maker | Use “only listed in” and name records. Say what missing evidence means rather than displaying an unexplained risk score. |
| Investor / commercial reviewer | No paid demand is established. Validate buyer, workflow fit, proof and willingness to pay before pricing or claiming savings. |

## Release gates

Local results and artifacts belong in the delivering PR. Required: frontend typecheck, lint, unit tests, build, full browser suite, responsive/axe checks, CI, reviewer merge and a clearly passed/pending hosted checklist. Keep new capability-dependent work blocked until CORE exposes an authorized, tested contract. Do not mark the full brief completed while these gates are outstanding.

Local validation and the pending hosted checklist: [LOCAL/MOCK evidence record](../../evidence/experience/director/README.md).
