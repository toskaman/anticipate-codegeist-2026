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

## 3 Nov 2026 - MCP check, ranking fix, Teamwork Graph prototype

- External MCP caller (Claude via mcp.atlassian.com, dev): `anticipate-simulate-upgrade` on MP-5 with MP-9 returned A NEEDS_REVIEW (3 impacted), B NEEDS_REVIEW, C PASS; `anticipate-check-plan-freshness` on plan-85ba308a returned CHANGED with "AVT-8 DEPENDS_ON AVT-3 [CONFIRMED]". PASS.
- R16 MEDIUM (FIXED): the comparison reported a tie between a declared-compatible upgrade (open question: no verified test) and an evidence-backed PASS. Ranking now counts open questions after violations; MCP/Rovo text lists open-question reasons. Regression test in `test/capabilities.test.ts`.
- Teamwork Graph: official docs (developer.atlassian.com/platform/teamwork-graph/scopes) say the API is in Forge Preview, needs `read:graph:<object>:<product>` scopes per object type on every hop, and each site admin can toggle scopes; no allowlisting is mentioned any more. Relationship types relevant to ANTICIPATE exist (`jira_work_item_impacts_compass_component`, `jira_work_item_links_external_build`, `jira_work_item_blocks_jira_work_item`). Prototype adapter `src/context/twg.ts` (parameterised Cypher via requestGraph, allowlisted relations, INFERRED only, outage = UNAVAILABLE, partial = PARTIAL), 4 tests. NOT wired and NO scopes added: adding scopes is a major version needing consent on every install, an owner decision. The Teamwork Graph bonus must not be claimed until a live query works on a site.

## 3 Nov 2026 - R8 validator outage policy (FIXED, unit tested; UI pending EXPERIENCE)
Admin-only setting `config:validator` (never expires): ALLOW (default) or BLOCK when the decision or issue cannot be read during a transition. Server-side admin check (`mypermissions ADMINISTER`), change logged, policy unreadable => ALLOW (no global lock-out). `runValidator` is now a pure, tested function (5 tests). Hosted test pending the Settings UI.

## 3 Nov 2026 - R17 HIGH: "migrate first" PASS opened the gate without any migration (FIXED)
Found during the hosted judge run on MOBL: option C ("Migrate consumers first") is PASS in simulation because it assumes the migration, and its plan contains only a decision comment. Completing it wrote an attestation with verdict PASS, so the workflow gate would open while consumers still depended on MOBL-58 in Jira. Fix: on completion the attestation also records the verdict of the change itself (the scenario without its MIGRATE assumptions) re-evaluated on live Jira evidence, excluding the plan's own created issues; the validator refuses while that verdict is BLOCKED. Regression test in `test/firewall.test.ts`. Backend 73/73.

## 3 Nov 2026 - Judge journey on dev (MOBL, build 5e45ed5)
Guided demo (6 issues, 4 links) → Analyze MOBL-58 → Scenario Lab (A BLOCKED, B NEEDS_REVIEW, C PASS suggested) → Decision Firewall (C: no violation) → plan (1 action) → approve → execute (VERIFIED, MOBL-58 comment) → Passport "Completed 1 of 1": PASS. User without create permission: unit tested only (needs a second account). Passport now exposes the validator decision (`gate`) because "Completed · Pass" alone was misleading for an assumed migration.

## 3 Nov 2026 - R4 remediated: zod 3 → 4.6.7 in backend, contracts and engine
No code change needed; backend 73, contracts 3, engine 11 green, typecheck and forge lint clean. Remaining `npm audit` items: 5 moderate (glob/minimatch via @forge/api and @forge/manifest; fix requires a breaking @forge/api major) - not exploitable at runtime in our context (build-time globbing of trusted manifest paths), tracked.

## 3 Nov 2026 - R18 MEDIUM: unreadable issue bypassed the BLOCK outage policy (FIXED)
- Evidence: `runValidator` mapped a non-`ok` issue read (`forbidden` 403, `not_found` 404, returned without exception by `getIssue`) to `null`, and `decideTransition(null)` returned `result: true` as if the issue had no `anticipate-change` label. The admin BLOCK policy was never consulted and nothing was logged.
- When: the validator reads the issue as the app; a 403 can come from issue security levels or a revoked app permission, a 404 from a deleted or moved issue, or from transient Jira errors mapped to these codes.
- Fix: an unreadable issue is unknown evidence, not an unlabelled issue. It now follows the outage policy (default ALLOW, unchanged for existing installs) and logs `{outage:true, policy, reason:"issue_forbidden"|"issue_not_found"}`. A readable issue without the label still passes without reading the policy. If the policy itself is unreadable, ALLOW applies (no global lock).
- Tests (RED then GREEN): test/validator-policy.test.ts, "validator: unreadable issue (R18)", 6 cases. Backend 80/80.
- Hosted check (3 Nov 2026, 13:05-13:10, dev one-atlas-euza, AVT): a temporary issue security scheme "Reporter only" was applied to AVT and AVT-9 created at that level with label `anticipate-change`. With the outage policy on BLOCK, the gated transition (En cours) was refused with "no ANTICIPATE decision has been recorded": the app still read the restricted issue (Forge app access is not limited by a reporter-only level on this site), so no 403 occurred. Conclusion: the 403/404 branch is not reproducible with issue security on this site; R18 stays a defense-in-depth fix proven by unit tests. Cleanup done: policy back to ALLOW (13:09), scheme detached from AVT and deleted, AVT-9 has no security level (it stays in the AVT test project, status Terminé).
