# Release Safety Control Plane (first slice)

**Question answered:** "Can this release proceed, which changes are blocked, and what still needs verification?"

Status: IMPLEMENTED · UNIT_TESTED · MOCK_TRANSPORT (UI). Not yet hosted-verified.

## How it works
- Resolver `getReleaseSafety({ projectKey, fixVersion | null })`. Read-only: no Jira writes, no storage writes.
- Requires `BROWSE_PROJECTS` on the project (checked live, as the calling user).
- Reads the change issues (`labels = "anticipate-change"`, optional `fixVersion`) as the calling user, paged by 50, with a bound of 100 issues.
- Joins each issue with the caller's own latest decision record (`decision:<KEY>`, owner = caller). Other users' plans are private and count as missing.
- Pure aggregation lives in `src/engine/release.ts`. The contract is `ReleaseSafety` in `packages/contracts`.

## Verdicts (worst first)
| State | Meaning |
|---|---|
| BLOCKED | Decision `EVIDENCE_CHANGED`/`INVALIDATED`, or policy verdict BLOCK (live verdict at completion when available) |
| EVIDENCE_INCOMPLETE | Verdict UNKNOWN, empty scope, or truncated search |
| NEEDS_REVIEW | No decision of yours, a pending/expired/failed decision, an expired attestation, or a release with interacting changes |
| EXECUTION_PARTIAL | Executed, but not every action was verified |
| APPROVED_NOT_EXECUTED | Approved; actions not executed |
| VERIFIED_FOR_RECORDED_SCOPE | Every change has a completed, verified, unblocked decision and no interaction exists. This is **not** a claim that the release is safe. |

## Interactions
These are structural signals: two release changes that are linked to each other (`DIRECT_LINK`), or that link to the same issue (`SHARED_DEPENDENCY`). They ask for a Portfolio simulation; they never claim a simulated conflict. At most 50 are listed, ordered deterministically.

## Known limits (shown in the UI)
- Unlabelled or unreadable changes are invisible.
- The decision mirror is last-writer-wins per issue. If someone else decided after you, your decision is not found and the change shows as NEEDS_REVIEW (fail-safe direction).
- Dependency evidence is limited to the change issues' direct links; the full graph is analysed per change in Scenario Lab.

## Release overview
`listReleaseSafety({ projectKey })` reads the same bounded scope once and groups it by fixVersion (plus "unscheduled"). It runs the same aggregation per release and sorts worst verdict first, then earliest release date. The UI button "Show all releases needing attention" lists them; one click opens the release. Tests check that the overview verdict equals `getReleaseSafety` for the same release.

## Next
Hosted dev proof on the ADM project (DEMO 2 shape), then one-click Portfolio simulation from an interaction.
