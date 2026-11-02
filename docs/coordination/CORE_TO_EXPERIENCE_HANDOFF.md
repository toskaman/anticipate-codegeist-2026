# CORE → EXPERIENCE handoff (single source)

## Feature: Continuous Decision Safety — status: DEPLOYED_DEV 4.12.0, VERIFIED_ON_REAL_JIRA (backend)
**Why:** an approved plan must not write to Jira if the dependency evidence changed after the snapshot.

### Wire compatibility
`meta.contractVersion` stays **"0.2.0"** (your client pins it). New things are additive:
- Error code `EVIDENCE_CHANGED` (from `approvePlan` and `executeApprovedPlan`), `error.details = { addedEdges[], removedEdges[], becameUnknown[] }`.
- Plan status `EVIDENCE_CHANGED` (appears in plan/passport reads after a refusal). Please accept it in your status rendering; today it may hit your INVALID_RESPONSE path.
- New read-only resolver `checkPlanFreshness({ planId })` → `EvidenceDrift` (schema in packages/contracts: `fresh`, `addedEdges`, `removedEdges`, `becameUnknown`, `ignoredPlanArtifacts`, `reason`, `checkedAt`).

### Suggested UX (your call)
- Before "Approve" and "Execute": optional "Check evidence freshness" → show FRESH / CHANGED with the diff list (edge `from KIND to [STATUS]`).
- On `EVIDENCE_CHANGED`: explain "Evidence changed since this plan was built — re-run comparison and review a new plan"; offer "Rebuild snapshot". Do **not** offer retry of the same plan (server refuses re-approval: CONFLICT).
- Observed today: after refusal the Plan screen showed "A mutation was requested… No execution records returned" without the reason → please surface `error.code/message/details`.

### States
loading (crawl up to depth 3 / 200 nodes, a few seconds), fresh, changed, PERMISSION_DENIED (other user's plan), SNAPSHOT_EXPIRED, NOT_FOUND.

### Example
`{"planId":"plan-…","snapshotId":"snap-…","checkedAt":"2026-11-02T14:30:00.000Z","fresh":false,"addedEdges":[{"from":"issue:TD-6","to":"issue:TD-1","kind":"DEPENDS_ON","status":"CONFIRMED"}],"removedEdges":[],"becameUnknown":[],"ignoredPlanArtifacts":[],"reason":"Evidence changed since the snapshot: 1 new dependency relation(s). Re-run the comparison and review a new plan."}`

### Tests (CORE)
test/drift.test.ts (6), test/concurrency.test.ts (3).
### Limitations
Detects causal relation changes (DEPENDS_ON/USES/BLOCKS) and readability loss within the snapshot's crawl limits; ignores labels/comments/timestamps and issues created by the plan itself.
