# Enterprise Decision Workspace (design, not implemented)

Status: DESIGN. Today every snapshot, plan and Passport is private to its creator (`owner === accountId`, enforced in `loadSnap`, `loadPlan`, `loadEvidence`). This doc proposes a shared, auditable flow without weakening that model and without migrating existing private plans.

## Flow
Proposal → Evidence review → Approval → Authorized execution → Verified outcome → Historical record.

## Capabilities (derived from Jira, checked server-side on every call)
| Capability | Rule (Jira, as the caller, project of the root issue) |
|---|---|
| read shared plan | BROWSE_PROJECTS |
| propose | BROWSE_PROJECTS + the root issue is readable |
| approve | member of a configured project role (default: "Administrators") — never the proposer when the project policy requires separation of duties |
| execute | the Jira permission each action needs (EDIT_ISSUES, CREATE_ISSUES, LINK_ISSUES, ADD_COMMENTS), checked live before each write (already implemented) |
| audit (Passport) | BROWSE_PROJECTS; historical reads still re-check access |

No app-side role list is trusted: roles come from Jira at request time, so removing someone from the project revokes access immediately.

## Data model (additive)
- `splan:{projectKey}:{planId}` shared plan record: `proposer`, `approvals[]` (accountId, at, actionIds, planHash), `executions[]`, `visibility: 'PROJECT'`.
- Append-only event log `sevent:{planId}:{seq}` (create with FAIL_IF_EXISTS): proposed, approved, executed, verified, invalidated. Never rewritten.
- Existing `plan:{id}` records stay private and are never converted silently; an owner may explicitly "share to project", which copies into `splan:` and logs it.

## Safety
- Approval is bound to the plan hash (as today) and to the approver's live capability; a stale approval (hash or evidence changed) is refused.
- Separation of duties: when enabled, `approver !== proposer` and `executor` must hold the action permissions; the attestation records all three account ids.
- Concurrency: the existing per-plan lease and idempotency keys apply unchanged.
- Privacy: audit fields store account ids only (no names, no issue text).

## Limits
Forge KVS has no cross-key transactions and no server-side query by project; listing shared plans needs an index key per project with bounded size. Approval by role requires the app to read project roles (`read:jira-work` covers it). No new scope expected; to verify before building.

## Effort and risk
About 3 to 5 days CORE plus UI. Not a release blocker; build after the judge path is verified on a clean site.
