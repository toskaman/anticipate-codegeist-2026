# Enterprise Decision Workspace

Status: BACKEND IMPLEMENTED behind capability flag `sharedDecisions` (OFF by default; see "Rollout rule"). No UI yet. Today every snapshot, plan and Passport is private to its creator (`owner === accountId`, enforced in `loadSnap`, `loadPlan`, `loadEvidence`). This doc proposes a shared, auditable flow without weakening that model and without migrating existing private plans.

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

## Implementation status (3 Nov 2026, issue #135, contract request #131)
- Core: `src/workspace/workspace.ts` (tests `test/workspace.test.ts`), op layer `src/workspace/ops.ts`, Forge wiring `src/workspace/forge.ts` (tests `test/workspace-ops.test.ts`).
- Contracts: section "shared decision workspace" in `packages/contracts/src/index.ts` (`SHARED_DECISION_OPERATIONS`, spread into `OPERATIONS`; feature `shared-decision-workspace`).
- Storage: `ws:dec:<id>` (immutable record, written once), `ws:slot:<id>:<n>` approval slots, `ws:appr:<id>:<account>` per-approver marker,
  `ws:term:<id>` terminal marker (REJECTED / REVOKED / EXPIRED, first writer wins), `ws:log:<id>:<seq>` append-only audit. All via `setIfAbsent`;
  no get-modify-set on anything that must not be lost. Private `plan:` records are only read, never changed.

## Rollout rule: off until the hosted two-account test
The flag lives in `config:feature:sharedDecisions` (`config:` keys never expire). Only a Jira site admin (global `ADMINISTER`, checked as the caller,
same pattern as `setValidatorPolicy`) can change it via `setFeatureFlag`. A missing or malformed record means OFF.
While OFF every workspace op fails with `UNSUPPORTED` + `details.reason = 'FEATURE_DISABLED'`, after reading only the flag key: no `ws:*` key is
read or written and no Jira call is made.
**Do not enable it on any customer site until the hosted test with two real accounts has passed** (proposer + approver on a dev site:
share, cross-account view, self-approval refused, approve, reject/revoke, access removal, `user/permission/search` adapter answers as expected).

## Contract (resolver ops)
| Op | Input | Who | Effect / errors |
|---|---|---|---|
| `getFeatureFlag` | `{flag:'sharedDecisions'}` | any signed-in user | `{flag, enabled, updatedBy, updatedAt, canEdit}` (never gated) |
| `setFeatureFlag` | `{flag:'sharedDecisions', enabled}` | Jira site admin (`ADMINISTER`) | writes the flag; others `PERMISSION_DENIED` |
| `shareDecision` | `{planId, requiredApprovals 1..3 = 1}` | plan owner with BROWSE on the plan's project | new decision `IN_REVIEW`, expires in 7 days; invalidated plan → `EVIDENCE_CHANGED` |
| `getSharedDecision` | `{id}` | BROWSE_PROJECTS on the decision's project, live | decision view |
| `approveSharedDecision` | `{id, planHash}` | `ADMINISTER_PROJECTS`, not the proposer | approval bound to planHash; idempotent per approver; wrong hash `CONFLICT`; plan changed/invalidated/gone `EVIDENCE_CHANGED`; expired/closed `CONFLICT` |
| `rejectSharedDecision` | `{id, reason 3..500}` | `ADMINISTER_PROJECTS`, not the proposer, not an approver who already approved | terminal `REJECTED` (first writer wins; loser `CONFLICT`) |
| `revokeSharedDecision` | `{id, reason 3..500}` | proposer or `ADMINISTER_PROJECTS` | terminal `REVOKED` from `IN_REVIEW` or `APPROVED` (first writer wins; loser `CONFLICT`) |
| `listDecisionAudit` | `{id, cursor: lastSeq or null, limit 1..100 = 50}` | BROWSE_PROJECTS | `{items, nextCursor}`; `nextCursor` = seq of the last item when more exist, else null |

Decision view: `id, projectKey, issueKey, planId, version (= planHash), planHash, proposer, createdAt, expiresAt, requiredApprovals,
state (IN_REVIEW | APPROVED | REJECTED | REVOKED | EXPIRED), approvals[{by, at, planHash}], evidenceChanged, waitingFor, closed {state, at, by, reason} | null,
capabilities {canApprove, canReject, canRevoke, canExecute}`, each `{allowed, reason}` with reason in the closed enum
`NOT_IN_ROLE, PROPOSER, EXPIRED, EVIDENCE_CHANGED, REVOKED, REJECTED, ALREADY_APPROVED, MISSING_PERMISSION, AWAITING_APPROVAL` or `null` (= allowed).
Precedence: closed state first, then role (PROPOSER / MISSING_PERMISSION / NOT_IN_ROLE), then ALREADY_APPROVED / AWAITING_APPROVAL, then EVIDENCE_CHANGED.
`AWAITING_APPROVAL` was added to the requested enum: no other code describes "execute before all approvals". `canExecute` is advisory (execution is
reserved to the proposer, who owns the private plan); `readyToExecute` re-validates every approver live and must be called by the executor.

Audit event: `id = "<decisionId>:<seq>"` (stable), `decisionId, seq, at, by, event (SHARED | APPROVED | READY | REJECTED | REVOKED | EXPIRED), detail | null`.
REJECTED / REVOKED carry the explicit reason as `detail` (free text typed by the user: the only non-id content in the audit).

## Execution gate (implemented)
Sharing first claims a write-once back-reference `ws:plan:<planId>` → decision id (`setIfAbsent`), then writes the decision.
A plan is shared at most once (a second share is `CONFLICT`: generate a new plan). If the decision write fails after the claim,
the plan can never execute (fail closed); the reverse order could have left a shared decision whose plan executes unreviewed.

`executeApprovedPlan` (src/engine/service.ts) runs every existing check (owner, status, engine approval bound to the plan hash,
snapshot expiry, evidence freshness, per-plan lease), then, **under the lease and before any status change or Jira write**, calls the
workspace `executionGate`:
- No back-reference: unchanged behaviour (one KVS read, no Jira call). Plans never shared are not affected.
- Back-reference present: the executor must be the **proposer** (decision: the proposer executes after approvals; approvers review but
  never run the proposer's private plan; anyone else is `PERMISSION_DENIED`). Then `readyToExecute(ctx, decisionId, currentPlanHash)`
  must be ok: decision `APPROVED`, not expired, plan hash unchanged and plan not invalidated, every approver still holding
  `ADMINISTER_PROJECTS` live (otherwise the decision becomes `REVOKED`), terminal marker re-read last.
- Refusals: `PERMISSION_DENIED` when an approver lost the permission (`details.reasonCode = MISSING_PERMISSION`), `CONFLICT` otherwise
  (`details = {decisionId, reason, reasonCode}` with reasonCode `AWAITING_APPROVAL | REJECTED | REVOKED | EXPIRED | EVIDENCE_CHANGED`).
  A missing decision record is `NOT_FOUND`; a malformed back-reference or one naming another plan's decision is `CONFLICT`. The lease
  is released and the plan status is unchanged; zero Jira writes.
- The executor still needs the Jira write permissions live (existing per-action `mypermissions` check). Concurrent executions keep
  the lease + per-action idempotency (one run, no duplicate writes).
- Approver permissions are checked with `JiraPort.userHasPermission` (asApp permission search, `createForgeJira`). A port without it
  refuses shared plans (`UNSUPPORTED`): no grant is ever assumed.
- The gate ignores the `sharedDecisions` flag: switching the flag off never releases a shared plan from review.
- `ws:plan:*` keys never expire (forgeStore `neverExpires`): a plan record's TTL is renewed on every write, so an expiring
  back-reference could silently release a long-lived shared plan. Other `ws:*` keys follow the 90-day default; decisions expire after 7 days.
Tests: test/shared-execution.test.ts.

## Remaining before enabling
- Hosted two-account test (rule above), including the asApp `GET /rest/api/3/user/permission/search?accountId&projectKey&permissions` adapter
  and a live shared execution (proposer executes after an approval; approver loses `ADMINISTER_PROJECTS` → refused, `REVOKED`).
- The engine's own `approvePlan` remains a separate step by the plan owner; it is not tied to the workspace approval (the gate is at execution).
