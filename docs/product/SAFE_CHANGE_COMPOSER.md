# Safe Change Composer (first slice)

**Question answered:** "What sequence or variant of these changes could satisfy our rules?"

Status: IMPLEMENTED · UNIT_TESTED · MOCK_TRANSPORT (UI). Not hosted-verified yet.

## How it works
- `composeSafeChanges` (read-only) takes the same input as `simulatePortfolio` (without proposedOrder). It shares the snapshot and permission validation through `portfolioSnapshot`.
- `packages/simulation-core/src/composer.ts` (pure) builds at most 8 candidates from fixed transformations. Each candidate is re-run through `simulatePortfolio`:
  - **AS_PROPOSED**: the current plan, in the engine's constraint order.
  - **RETAIN_OLD**: one removal becomes a deprecation (at most 3).
  - **COMPATIBLE_UPGRADE**: one breaking upgrade becomes non-breaking (at most 3). The compatibility layer is an assumption.
  - **RETAIN_ALL_COMPAT**: every removal retained and every breaking upgrade made compatible.
  - **SPLIT_PHASES**: interacting changes in separate phases. It is scored on the combined end state, so it never claims to resolve a conflict.
- Migrations are never invented. "Migrate first" exists only as the ordering of a migration already in the plan.
- **Ranking** (lexicographic, derivable criteria only): verdict, confirmed blockers, ordering cycles, conflicts, unknowns, impacted nodes, number of changed operations. No costs, probabilities or risk percentages. A candidate is "outperformed" when another is at least as good on every criterion and needs no more assumptions.

## UI
In Scenario Lab → "Several changes at once", after a portfolio run, "Compose safer alternatives" lists the candidates best first. Each shows:
- its metrics;
- its changes compared with the plan;
- its phases;
- the conflicts it resolves;
- its assumptions and required reviews.

"Select for review" never approves or executes anything; a selected candidate still goes through Scenario Lab, approval and verified execution.

## DEMO 2 result (test/composer.test.ts)
- **As proposed:** 2 conflicts (MIGRATE_ONTO_RETIRED, EMERGENT_IMPACT); 4 consumers impacted.
- **#1 "Compatibility phase for TD-5":** 0 conflicts, 0 impacted. It assumes a compatibility layer keeps the old contract.
- **"Split into phases":** still 2 conflicts on the end state, ranked below.
