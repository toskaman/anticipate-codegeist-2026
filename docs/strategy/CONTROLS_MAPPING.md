# Controls-mapping appendix (gauntlet Q28)

READ FIRST: this appendix maps common change-governance questions to product records a
buyer can inspect. It claims **no certification, no legal mandate, and no compliance
standing**. The Prevention Passport states it is an audit-style record, not a legal or
cryptographic certificate. Any compliance use must be validated by the buyer's own
legal/compliance team. Wording here was chosen to avoid mandate language; keep it that way.

| Governance question | Product record that answers it | Where to find it |
|---|---|---|
| Who approved this change, and exactly what did they approve? | Approval bound to plan hash + action selection, with account + timestamp | Prevention Passport → Approvals; `getPreventionPassport` |
| What evidence was the decision based on? | Frozen snapshot: nodes/edges with CONFIRMED/INFERRED/UNKNOWN + Jira sources | Passport → Evidence; Time Machine checkpoints |
| Were safer alternatives considered? | Ranked candidates with metrics, assumptions, resolved/remaining conflicts | Composer output; Passport → Alternatives |
| Did the approved work actually happen? | Per-action VERIFIED by Jira read-back (or PARTIAL/FAILED, never overstated) | Passport → Verified outcomes; execution timeline |
| What if the facts changed after approval? | Invalidation checkpoints + refusal with zero writes + named diff | Time Machine; `checkPlanFreshness`; radar hints |
| Who can approve or execute, and what stops one person doing both? | Server-side auth; shared decisions with separation of duties (release-locked until #131 passes) | `approvePlan`/`executeApprovedPlan` gates; workspace ops |
| Can an unreviewed change pass the Jira gate? | Validator refuses unless COMPLETED + verified + unblocked + unexpired + links-digest match | Workflow validator decision + reason; admin guide |
| What happens during an outage? | Explicit admin policy (Allow default / Block), non-admin read-only | Settings → outage policy; admin guide |
| Is the decision reproducible later? | Deterministic engine + result hashes + retained checkpoints (explicit retention limits) | Simulation results; `getDecisionHistory` |
| Where did agent tools act, and what could they not do? | Read-only tool inventory; no tool approves or executes | `manifest.yml` `rovo:mcp`; Rovo agent prompt |

Out of scope (do not add without legal review): mapping to named regulations,
certifications, audit standards, or any "compliant with X" phrasing.
