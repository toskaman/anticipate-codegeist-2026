# Decision Time Machine (first slice)

**Question answered:** "Why was this decision acceptable before, and why is it blocked now?"

Status: IMPLEMENTED · UNIT_TESTED · MOCK_TRANSPORT (UI). Not hosted-verified yet.

## Records it uses (only what is retained)
- **Baseline:** the minimized provenance record `prov:<planId>`: causal relations of the snapshot the plan was built on, ≤300, kept 90 days.
- **Checkpoints:** new bounded record `hist:<planId>`. One checkpoint is written for every evidence re-check: at approval, at execution, and on "Re-check evidence".
  - Each checkpoint is a diff against the baseline: added/removed relations and nodes that became unknown, ≤100 each.
  - Only the newest 20 are kept; dropped ones are counted.
  - Writing it is best effort: a storage failure never weakens the refusal (tested).
- **Events:** the plan timeline, approvals (with plan hash) and Decision Radar observations.

## Operation
`getDecisionHistory({ planId })` is read-only: no Jira read, no write. Only the plan owner can call it. It never reads present-day Jira, so history cannot be overwritten by today's state (tested).

## UI
A panel on the Prevention Passport page shows:
- "Why this decision is blocked now".
- A timeline of checkpoints, with the invalidating one marked.
- A comparison of any two recorded checkpoints: added, removed, evidence status changed, became unknown. The shared deterministic `compareCheckpoints` lives in packages/contracts.
- The recorded events, and the limits of the history.

## Limits
- Plans created before this release have no checkpoints until their next re-check.
- Changes between two checks are never interpolated.
- The baseline is causal relations only.
