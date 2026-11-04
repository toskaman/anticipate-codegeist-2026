# Policy-as-code (P2) — preview engine

Status: **pure engine module only, preview only.** Code: `packages/simulation-core/src/policy.ts`; tests: `packages/simulation-core/test/policy.test.ts`.
Nothing in the app, the resolvers, Rovo or the Jira workflow validator calls it yet. It enforces nothing.

## Why

Teams want to state their own change rules ("a breaking change touching 5+ services needs an independent approval") instead of
relying only on the four built-in Decision Firewall rules. The design goal is to let them do that **without** introducing a
scripting surface: a policy is data in a closed vocabulary, evaluated deterministically against evidence ANTICIPATE already has.

## What it does not replace

- The built-in Decision Firewall rules P1–P4 (`src/engine/policies.ts`, evaluated by `evaluatePolicies` in
  `packages/simulation-core/src/index.ts`) are unchanged and still drive every simulation verdict.
- The Jira workflow validator (`src/validator.ts`) is unchanged and still gates transitions only on a COMPLETED, attested plan.

A policy set is evaluated **on top of** a simulation result; the rule `BLOCK_WITH_CONFIRMED_BLOCKERS` reads P1–P4 violations, it does not redefine them.

## Schema (version 1)

```ts
PolicySet {
  schemaVersion: 1,
  id: SafeId,                                   // /^[A-Za-z][A-Za-z0-9._-]{0,63}$/
  scope: { projectKeys: JiraKey[] },            // 1..100, unique, /^[A-Z][A-Z0-9_]{0,19}$/
  rules: Rule[]                                 // 1..50, unique ids
}
Rule = { id: SafeId, type, ...params }          // closed discriminated union, strict objects
```

| Rule type | Parameters | Trigger | PASS | NEEDS_REVIEW | BLOCK |
|---|---|---|---|---|---|
| `REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING` | `minImpacted` 1..5000 | REMOVE_NODE or breaking UPGRADE_NODE impacting ≥ `minImpacted` items | plan for this snapshot+scenario is APPROVED / EXECUTING / COMPLETED | plan not supplied; plan for another scenario; below threshold but impact set incomplete (UNKNOWN path / truncation) | no plan, or plan not yet approved |
| `REQUIRE_INDEPENDENT_APPROVAL` | `changeKinds` ⊂ {REMOVE_NODE, DEPRECATE_NODE, UPGRADE_BREAKING, UPGRADE_COMPATIBLE, MIGRATE_DEPENDENTS}, `minApprovers` 1..3 | scenario contains one of the kinds | ≥ `minApprovers` distinct non-proposer approvals bound to the current plan hash | plan or approval records not supplied; plan for another scenario | no plan, not shared, too few independent approvals (self-approvals and stale-hash approvals never count) |
| `BLOCK_WITH_CONFIRMED_BLOCKERS` | — | always | no BLOCKER violation and every impact path known | BLOCKER violation only on INFERRED/UNKNOWN evidence; or no blocker but UNKNOWN paths / truncation (a blocker may be hidden) | a BLOCKER violation reaches at least one node over an all-CONFIRMED path |
| `REQUIRE_VERIFIED_TEST_EVIDENCE` | `nodeKinds` ⊂ NodeKind | impacted items of those kinds | all have a CONFIRMED `VERIFIED_BY` edge | only INFERRED/UNKNOWN test links; impacted node of UNKNOWN status/kind; impact set incomplete | an impacted item of a listed kind has no test link |
| `INVALIDATE_ON_EVIDENCE_CHANGE` | — | a plan exists | latest `EvidenceDrift` for this plan is fresh | plan not supplied; never checked; check belongs to another plan/snapshot | drift not fresh; plan EVIDENCE_CHANGED / INVALIDATED |
| `BLOCK_INCOMPLETE_PLAN` | — | always | plan COMPLETED (and, if execution records are supplied, all VERIFIED/SKIPPED) | plan not supplied; plan for another scenario | no plan; any other status; COMPLETED with an unverified execution |

A rule whose trigger does not hold returns `PASS` with `applicable: false` and an explanation starting with "Not applicable".

### Facts

`evaluatePolicySet(set, facts)` reads existing structures only: `GraphSnapshot`, `ScenarioDefinition`, `SimulationResult`
(must be for the same snapshot and scenario, otherwise `VALIDATION`), and optionally `PreventionPlan`, `ExecutionRecord[]`,
`EvidenceDrift`, and the `proposer / approvals / planHash` of a `SharedDecision`.
**`undefined` = not supplied (unknown), `null` = known to be absent.** Unknown evidence never yields PASS for a rule that depends on it.

### Output

```ts
{ policySetId, schemaVersion: 1, mode: 'PREVIEW' | 'ENFORCE', inScope, overall: PASS | NEEDS_REVIEW | BLOCK,
  results: [{ ruleId, type, outcome, applicable, explanation, evidenceRefs }], resultHash }
```

Results follow the declared rule order; `evidenceRefs` are sorted (`node:`, `edge:`, `violation:`, `plan:<id>@<hash>`,
`drift:<planId>@<checkedAt>`, `approval:`, `execution:`) and capped at 100; explanations at 1000 characters. Out of scope
(project key not listed): `inScope: false`, no results, overall PASS. The output and `resultHash` do not depend on the order
of snapshot nodes/edges. `previewPolicySet` is `evaluatePolicySet` with `mode: 'PREVIEW'`; `ENFORCE` is only a label for a
future caller — this module never blocks anything by itself.

## Validation and versioning

- Strict zod schemas: unknown rule types, unknown fields (e.g. `when: "impacted > 3"`), code-like identifiers
  (`x;process.exit()`, `${…}`, `<script>`), non-numeric parameters, duplicates, more than 50 rules → rejected (`PolicySetError VALIDATION`).
- `migratePolicySet(raw)`: version 1 is the identity; versions are upgraded step by step through an explicit migration table
  (empty today). A version newer than the supported one is rejected with `UNSUPPORTED_SCHEMA_VERSION`, never guessed.
  Missing or non-integer versions are `VALIDATION` errors.

## What is enforced today

**Nothing new.** No storage, resolver, UI, Rovo action or validator reads a policy set. The engine exists so the semantics can
be reviewed and tested before any product surface depends on it.

## Activation plan (not started)

1. **Storage + admin-only edit**: a policy set per installation, writable only by Jira site admins (same gate as
   `setValidatorPolicy` / `setFeatureFlag`), validated with `migratePolicySet` on every read and write; every change audited (who, when, old/new hash).
2. **Preview first**: show `previewPolicySet` results next to the existing verdict and in the Passport, clearly labelled "preview — not enforced", for a trial period.
3. **Enforce per rule, opt-in**: an admin promotes individual rules to enforced; the workflow validator would then also require
   no enforced BLOCK on the attested plan. Enforcement changes are audited and reversible.
4. **Hosted evidence** before enabling enforcement anywhere (two-account test, as for the shared decision workspace).

## Safe fallback

- Invalid, unknown-version or unreadable policy set → it is ignored and the built-in rules P1–P4 plus the existing validator apply unchanged (fail to current behaviour, never to "allow everything").
- Missing facts → NEEDS_REVIEW, never PASS.
- A policy set can only add review/blocking outcomes on top of the built-in verdict; it cannot turn a built-in BLOCKED into PASS.
