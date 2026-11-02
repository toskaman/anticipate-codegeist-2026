# ANTICIPATE: CORE engineering report

Living document. Last update: 2 Nov 2026 (evening). Status labels: IMPLEMENTED, UNIT TESTED, HOSTED TESTED (Forge development, real Jira), PRODUCTION DEPLOYED, BLOCKED, PLANNED.

## 1. Commit and deployment status

| Item | Value |
|---|---|
| `main` before this work | `0d9ffa7` (PR #16), later PR #17 (UI) merged |
| This change set | branch `feat/core-engine`, PR "CORE: decision attestations, passport retention, compatibility evidence" |
| Forge development | deployed from `feat/core-engine` + UI build of PR #17 |
| Forge production | updated after merge (see section 10) |
| Tests | backend 52, simulation 11, contracts 3, `forge lint` clean, typecheck clean |

## 2. Architecture (unchanged foundations)

Custom UI (`global:fullPage`) -> resolvers (`src/main.ts`, envelope + zod contracts in `src/core/handler.ts`) -> use cases (`src/engine/service.ts`) -> ports (`JiraPort`, `Store`) -> Forge adapters (`asUser`/`asApp` REST, KVS with TTL). Pure deterministic engine in `packages/simulation-core`. Read-only Rovo actions / MCP tools in `src/rovo.ts`. Jira workflow validator in `src/validator.ts`.

## 3. Risk register

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| R1 | CRITICAL | Prevention Passport became unreadable 2 days after the plan: `getPreventionPassport` called `loadSnap`, and `snap:*` keys expire after 2 days (`retentionFor`), while plans live 90 days. | Reproduced in `test/retention.test.ts` with an emulated KVS TTL clock (old code throws NOT_FOUND). | FIXED, UNIT TESTED |
| R2 | CRITICAL | Workflow validator accepted any `COMPLETED` decision forever, not bound to evidence, expiry or issue. | `src/validator.ts` (previous version), `test/usecases.test.ts`. | FIXED, UNIT + HOSTED TESTED |
| R3 | HIGH | Concurrent "create sample data" requests could create duplicate sample issues (check-then-create race). | `test/sample.test.ts` concurrency case. | FIXED, UNIT TESTED |
| R4 | HIGH | zod 3 advisory GHSA-mrhx-c7xc-m3w5 (memory on oversized collections); no 3.x fix. | `npm audit --omit=dev`. | MITIGATED in code: payload size bound (64 000 chars) enforced before schema parsing; regression test. Migration to zod 4 still PLANNED. |
| R5 | MEDIUM | "Compatible" upgrade was treated as proven compatible (no uncertainty). | `packages/simulation-core`. | FIXED: declared vs verified compatibility, tests. |
| R6 | MEDIUM | Plans and snapshots are private to their creator: no reviewer/approver separation. | `loadPlan` owner check. | OPEN, design in section 6. |
| R7 | MEDIUM | Moderate advisories in `@forge/api` transitive deps (glob, minimatch); only fix is a breaking `@forge/api` major. | `npm audit`. | OPEN, upgrade after compatibility check. |
| R8 | MEDIUM | Validator fails open on outages (documented). Not configurable yet. | `src/main.ts` `validateTransition`. | OPEN, design in section 5. |
| R9 | LOW | Time-of-check/time-of-use gap between freshness check and Jira write. | Platform has no cross-system transaction. | ACCEPTED LIMITATION, documented; per-action verification remains. |
| R10 | LOW | Cold start: hosted page can stay blank 20-30 s on first open. | Observed on dev and production. | OPEN: measurement needed (Forge function cold start vs Custom UI asset load). |

## 4. R1 fix: Passport retention

- On plan generation a minimized provenance record `prov:{planId}` is stored with the plan's 90-day retention: snapshot id, mode, capture and expiry dates, node and edge counts, the causal edges reviewed (from, to, kind, status; max 300) and a digest of the full snapshot. No issue text.
- `getPreventionPassport` uses the live snapshot when retained, otherwise the provenance record. The response has `evidence.state` = `LIVE`, `EXPIRED_SNAPSHOT` or `ARCHIVED`, and the disclaimer starts with "HISTORICAL RECORD" when not live.
- Archived evidence can never be used for new work: compare, plan, approve and execute still require the live snapshot.
- Ownership is enforced on historical reads. After 90 days everything is gone (test asserts an empty store).
- Integrity: the digest is an FNV-1a content fingerprint for change detection, not a tamper-proof signature. A tamper-evident record would need a server-held key (HMAC) or signatures; not claimed.
- Legacy plans created before this change have no provenance; once their snapshot expires the Passport returns an explicit NOT_FOUND.

## 5. R2 fix: Decision attestations (validator schema 2)

Written only when a plan reaches COMPLETED. Fields: issue key, plan id, plan hash, snapshot id, scenario, `linksDigest` (order-independent digest of the issue's links re-read from Jira right after verified execution, so the plan's own new links are included), `validUntil` (14 days).

The validator (no graph crawl; one issue read + one storage read) allows a gated issue only if all hold: decision exists for that exact issue, status COMPLETED, schema 2, not expired, current links digest equals the attested one. Legacy records are refused with a clear message to re-run the plan.

Hosted proof (dev, isolated project AVT with its own workflow): plan `plan-85ba308a...` on AVT-3, 4 actions approved and verified; transition to "En cours" accepted (HTTP 204); back to Backlog; a new Blocks link AVT-3 -> AVT-8 added; transition refused with HTTP 400 "its dependency links changed after plan ... was verified".

Outage policy: still fail-open (documented). A configurable fail-closed mode needs an admin-only setting with an audit trail; not shipped until it can be configured and observed safely.

## 6. Enterprise decision workspace (design, not implemented)

Proposal -> Evidence review -> Approval -> Authorized execution -> Verified outcome -> Historical record. Capabilities derived from Jira project permissions checked server-side at each step (`mypermissions` as the caller): BROWSE to read, a project-role-based approver capability, EDIT/CREATE/LINK/COMMENT to execute. Separation of duties: the approver cannot be the proposer when the policy requires it. Shared records keyed by project, not by account; existing private plans are not migrated silently. Needs coordination with EXPERIENCE for screens.

## 7. Compatibility evidence (implemented, first step)

| Claim | Engine behaviour |
|---|---|
| Breaking upgrade | impacts propagate to consumers |
| Declared compatible, no confirmed test on the upgraded item | no propagated impact, but `MISSING_TEST_EVIDENCE` uncertainty; verdict NEEDS_REVIEW |
| Compatible with a CONFIRMED `VERIFIED_BY` test | PASS |

Unit test shows the same upgrade moving from NEEDS_REVIEW to PASS when a contract test is linked. Next sources to evaluate: Jira development information (PRs, builds), OpenAPI diffs. Not implemented; no test results are ever invented.

## 8. Prioritization

BUILD NOW: attestations (done), passport retention (done), sample lease (done), payload bound (done), cold-start measurement, Devpost/video.
EXPERIMENT: portfolio multi-change conflict simulation (isolated proof of concept in the engine).
RESEARCH: Jira development information as compatibility evidence; collaborative workspace permissions.
DEFER: policy-as-code editor UI, Marketplace listing, zod 4 migration (after Codegeist freeze unless risk-free).
REJECT: probabilistic incident prediction; arbitrary user-supplied policy code.

Dangerous distractions: many more scenario types; a policy UI without server enforcement; Teamwork Graph work before allowlisting; Marketplace listing (separate app identity); large refactors before the deadline.

## 9. Hackathon compliance (to recheck against https://codegeist2026.devpost.com/rules before submission)

| Item | Status |
|---|---|
| Forge app on Jira, public repo | PASS |
| Installation link for judges, tested on a clean site | PASS (toskaman5962) |
| English Devpost text | DRAFT (`docs/submission/DEVPOST_DRAFT.md`) |
| Video < 5 min, public, no unlicensed music | TODO (owner: team) |
| Bonus nomination: one (MCP) | DRAFT |

## 10. Hosted validation log (this change set)

- Validator attestation: PASS on dev (section 5).
- Plan execution with UI v3: 4/4 actions VERIFIED on AVT.
- Passport archived state: unit tested only (needs 2 days to observe hosted).

## 11. Known blockers

Teamwork Graph API allowlisting (request sent by the team). Production smoke depends on Forge cold start.

## 3 Nov 2026 - P0 audit of the Decision Firewall

| # | Sev | Finding | Status |
|---|---|---|---|
| R11 | CRITICAL | Partial-approval bypass: approving and verifying only the decision comment made the plan COMPLETED and wrote an attestation that opened the workflow gate. Also an execution with zero approved actions counted as COMPLETED. | CONFIRMED by RED test (`test/firewall.test.ts`), FIXED: COMPLETED requires every plan action approved and verified; otherwise PARTIAL. |
| R12 | CRITICAL | Completing all preventive actions of a BLOCKED option (creating migration tickets) authorized the transition, i.e. tickets were treated as a resolved migration. | CONFIRMED, FIXED: attestation schema 3 records the chosen option verdict and blocker count; validator refuses BLOCKED. |
| R13 | HIGH | Missing identity could match a record whose owner is null. | FIXED: private reads/writes require an authenticated account. |
| R14 | MEDIUM | Approval idempotency key reused with another selection was silently accepted as a replay. | FIXED: key bound to plan + selection fingerprint; CONFLICT on mismatch. |
| R15 | MEDIUM | Empty approval relied only on the resolver contract. | FIXED: service-level VALIDATION. |

Tests: backend 63 (8 new adversarial tests: partial approval, BLOCKED completion, failed-after-verified, empty approval, cross-user read/approve/execute with zero Jira writes, anonymous caller, idempotency payload mismatch). Validator outage policy is still fail-open (documented, unchanged).

Hosted proof (dev, 2 Nov 2026 23:24 CET, isolated project AVT): new plan `plan-650c2202...` on AVT-3, only the decision comment approved and executed (VERIFIED). Jira transition to "En cours" refused with HTTP 400: "...the latest prevention plan plan-650c2202-... is PARTIAL, not COMPLETED." Before the fix the same sequence produced COMPLETED.
