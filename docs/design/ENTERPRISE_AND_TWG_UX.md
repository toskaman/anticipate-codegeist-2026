# Enterprise workspace and Teamwork Graph: UX proposal (not built)

Status: design only, 3 Nov 2026. Nothing here is shown in the app until CORE provides and enforces the contract (request R-38). The app today is single-user: a plan, its approval and its Passport belong to the person who created them.

## 1. Shared decision workspace

Based on CORE's `docs/design-core/ENTERPRISE_WORKSPACE.md`. Roles come from Jira at request time; the UI only displays what the backend allows.

### Journey
| Step | Who acts | What the screen shows | Backend fact needed |
|---|---|---|---|
| 1. Propose | Developer | "Proposed by {name} · {time}", the change and chosen option | proposer, plan hash |
| 2. Evidence review | Anyone with project access | Graph and comparison, read-only, with "Evidence captured {time}, expires {time}" | snapshot expiry |
| 3. Comments | Reviewers | Comment thread per plan (or a link to the Jira issue comments) | comment source, or reuse Jira comments |
| 4. Approval required | Approver role | A banner: "Waiting for approval by a member of {role}". The proposer sees why they cannot approve (separation of duties) | `canApprove` + reason code |
| 5. Approved or rejected | Approver | Who decided, when, which actions, plan hash | approvals[], rejection reason |
| 6. Authorized execution | Executor with Jira permissions | Actions with the permission each one needs; missing permissions named | per-action permission check |
| 7. Verified outcome | — | Same status rules as today (Verified only after reading Jira back) | executions[] |
| 8. Shared Passport | Project members | "Visible to people who can browse {project}" | visibility rule |

### Screen elements
- **Decision header**: proposer, approver(s), executor, with the current step highlighted ("Waiting for: approval").
- **Who can act**: for the viewer, a single line: "You can review" / "You can approve" / "You cannot approve: you proposed this change". Never a disabled button without its reason.
- **Expiry**: "Approval valid until {time} or until the evidence changes".
- **Activity log**: append-only events (proposed, approved, executed, verified, invalidated), read from the backend log.

### Contract asked from CORE
`canApprove: boolean` with `reason` (`NOT_IN_ROLE` | `PROPOSER` | `EXPIRED` | `EVIDENCE_CHANGED`), `waitingFor: 'APPROVAL' | 'EXECUTION' | null`, `approvalExpiresAt`, `visibility`, events[]. Until it exists, the current single-user flow stays and no multi-user wording appears.

## 2. Teamwork Graph provenance

Today the "Evidence sources" strip shows Jira only, and Teamwork Graph as reported by the backend capability (currently "Not configured").

### Source states (strip and Settings)
States follow the existing contract value `FULL` (not `LIVE`, which already means the backend mode). Status 3 Nov 2026: blocked by Atlassian allowlisting (ECOHELP-180616); the app keeps showing Not configured.

| State | Label | Meaning shown to the user |
|---|---|---|
| FULL | Teamwork Graph · included | Relations from it are included in this snapshot |
| PARTIAL | Teamwork Graph · partial | Some sources could not be read; listed in the inspector |
| UNAVAILABLE | Teamwork Graph · unavailable now | Read failed for this snapshot; results use Jira only |
| NOT_CONFIGURED | Teamwork Graph · not configured | Needs admin setup or scopes; results use Jira only |

### Per relation (inspector and list view)
- **Source**: "Jira issue link ABC-1 → ABC-2" or "Teamwork Graph: pull request #… references ABC-1", with a link when the backend provides one.
- **Kind** (CORE `evidenceKind` + `feedsSimulation`): VERIFIED_LINK → "Verified dependency" (counts in simulations); DOCUMENTARY → "Context only" (shown, never changes a verdict), with one sentence explaining why.
- **Access**: if hidden because of permissions, "You cannot read this source", never removed silently.

### Demo sequence (only if hosted and real)
1. Graph with Jira only. 2. The same change after Teamwork Graph is connected: one extra consumer appears, tagged with its source. 3. Scenario Lab shows the change in affected count. If no real extra relation exists on the demo site, the video does not show this sequence.
