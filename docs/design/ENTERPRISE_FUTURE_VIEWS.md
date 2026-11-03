# Future enterprise views — design proposal, not connected features

Date: 4 November 2026. This extends ENTERPRISE_AND_TWG_UX.md without changing its single-user default or decision D3. These views are not in product navigation and make no Forge requests. Proposed fields below are UX requirements, not shared backend contracts. Any provisional view models/components must stay inside the frontend and carry a fixed concept label until CORE approves the runtime contract.

## Portfolio Impact Command Center

CORE handoff: [#130](https://github.com/toskaman/anticipate-codegeist-2026/issues/130). Muse's [#129](https://github.com/toskaman/anticipate-codegeist-2026/pull/129) contains a pure engine; that alone does not enable a product feature.

Composition: selected change list -> evidence snapshot/time -> combined impact summary -> shared consumers -> conflicts/prerequisites -> causal detail -> alternative ordering. Reveal a pair of changes before a full portfolio. Never put every relation in a single animated map.

- Each shared consumer identifies the change IDs that affect it and the supporting edge IDs/status/source. Count distinct records, not edges.
- Ordering is a supplied constraint or a hypothesis, explicitly distinguished. A cycle has no approved sequence. Missing analysis is not “no conflicts”.
- Project/component/team grouping uses supplied identifiers only. Release exposure needs an actual version/date; absent data says “Not assessed”.
- All analysis is read-only. An execution sequence is not a queue that will execute. Keep actions hidden unless a separate reviewed execution contract exists.
- View states: capability absent, permission required, selection empty, analyzing, complete with unknowns, partial/truncated, expired, incompatible snapshots, unavailable.
- Gate: server operation and capability exist, request/response validate, permissions are enforced, limits/cursors are agreed, unit and hosted deterministic/zero-write tests pass.

## Shared decision workspace

CORE handoff: [#131](https://github.com/toskaman/anticipate-codegeist-2026/issues/131). Do not expose the prototype just because concurrency tests exist.

Composition: change and immutable plan version -> “Waiting for” strip -> role-specific allowed next step -> evidence and alternatives -> approval/rejection history -> execution receipts -> shared Passport.

| Viewer state | Presentation | Server requirement |
| --- | --- | --- |
| Proposer | Can review; self-approval prohibition explained if applicable | Actor identity, separation-of-duties policy and reason |
| Reviewer | Read-only evidence and questions | Browse authorization and redaction |
| Approver | Exact action/version scope, expiry, explicit confirm | Server role/permission, version/hash and validity check |
| Executor | Only backend-approved permitted actions | Re-check approval, lease, Jira permissions and freshness |
| Access removed | Permission explanation; no leaked actor/event data | Read/mutation refusal and redacted response |
| Rejected / revoked / invalidated | Who/when/reason if visible; clear safe next step | Version-bound append-only event, no reuse of prior approval |

Rejection and revocation require a reason and a confirmation describing what becomes invalid. Do not suggest a client-side role switch. Handle stale-write conflicts by re-reading; never retry a mutation silently. Dates and actors are backend facts; an unavailable identity is “Not supplied”, not an invented display name.

## Continuous Decision Radar

CORE handoff: [#132](https://github.com/toskaman/anticipate-codegeist-2026/issues/132). On-demand freshness checks are not a subscription.

Composition: monitoring state/last observation/lag -> small actionable queue -> reason for attention -> before/after evidence -> permitted next step. Sort invalidations and expiry above informational verified outcomes. Use stable IDs to avoid repeated notices and distinguish acknowledgement from resolving the underlying fact.

- No events + healthy recent observation: “No actionable changes reported for this scope”. Never “Everything is safe”.
- No observation, stale feed or partial outage: show the coverage/lag gap rather than a green zero.
- Each item explains why it matters (source changed, approval expired, action unverified) and which read/review step is available.
- Private or unreadable events must be filtered/redacted by CORE. Counts must not reveal private decisions. No automatic external notifications, approval or execution.
- “Continuous” appears only after CORE event delivery, deduplication, access-revocation, missed-event recovery and hosted event-to-UI proof pass.

## Component contract boundary

Reuse existing Panel, Badge, Notice, EvidencePath, DecisionDialog and Passport sections. Concept views must be passive (no network client or pretend actions), always labelled “Design concept — not connected”, and excluded from the production entry tree. The production fallback remains the working single-change journey. Formal acceptance occurs only when approved runtime schemas replace frontend-only proposals and the capability signal is present.
