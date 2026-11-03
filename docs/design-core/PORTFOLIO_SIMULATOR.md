# Portfolio Impact Simulator

`packages/simulation-core/src/portfolio.ts` — `simulatePortfolio(snapshot, changes, opts?)` and `portfolioReport(result)`.
Contracts: `PortfolioChange`, `PortfolioInput`, `PortfolioResult` (+ `PORTFOLIO_LIMITS`) in `packages/contracts/src/index.ts`.

It answers: *if these 1..10 proposed changes happen together, what do they touch, where do they collide, and in which order can they be done?*
It is pure (no I/O, clock, randomness or input mutation) and deterministic: the same snapshot id, changes (in any order), rules, depth and proposed order give the same result and `resultHash`.

## Input and limits

| Bound | Value | On violation |
|---|---|---|
| changes | 1..10, unique `id` | `PortfolioError` code `VALIDATION` |
| operations per change | 1..20 (REMOVE_NODE, DEPRECATE_NODE, UPGRADE_NODE, MIGRATE_DEPENDENTS) | `VALIDATION` |
| referenced nodes | must exist in the snapshot; self-migration (`from == to`) rejected | `VALIDATION` |
| maxDepth | 1..10 (default 6) | `VALIDATION` |
| proposedOrder (optional) | permutation of change ids | `VALIDATION` |
| graph | ≤ 2000 nodes, ≤ 10000 edges | `BUDGET_EXCEEDED` |

`opts.rules` (policy rules) are optional; without them verdicts depend only on evidence uncertainty.

## Algorithms

Impact semantics are the engine's: `from --USES|DEPENDS_ON--> to` means changing `to` may impact `from`; roots are removed, deprecated and breaking-upgraded nodes; migrations rewire only CONFIRMED/INFERRED edges.

1. **Individual runs** — `simulate` per change (identical result and hash to calling the engine directly).
2. **Ordering constraints** (between distinct changes A, B):
   - `MIGRATE_BEFORE_RETIRE`: A migrates dependents off X, B removes/deprecates X → A before B.
   - `RETIRE_CONSUMER_FIRST`: B removes a node that (transitively) consumes a node A removes/deprecates → B before A.
   - `DEPENDENCY_FIRST`: otherwise, when B's target consumes A's target → A before B (dependency changes first).
   Cycles are found with **Tarjan SCC** and reported as unsatisfiable groups (`ordering.cycles`, `order = null`). Otherwise **Kahn** topological sort with lexicographic tie-break gives `ordering.order`.
3. **Combined run** — all operations applied in `order` (change-id order when cyclic). Order matters only for chained migrations.
4. **Shared impacts** (impacted by ≥ 2 individual runs), **emergent impacts** (only in the combined run), **masked impacts** (in some individual run, not in the combined one — e.g. migrated away or itself a target of another change).
5. **Conflicts** (sorted, ids `C1..Cn`), each with change ids, nodes, a reason and UNKNOWN evidence edges:
   `MIGRATE_ONTO_RETIRED`, `COMPETING_MIGRATION`, `SAME_TARGET`, `DEPENDENCY_CHAIN`, `EMERGENT_IMPACT` (attributed to the owners of the witness path's root plus the changes whose migrations rewired an edge on it, via a replay of the migration semantics).
6. **Evidence gaps** per change: `UNKNOWN_ON_IMPACT_PATH` (UNKNOWN edge on a BFS witness path) and `UNKNOWN_NOT_MIGRATED` (UNKNOWN dependency left on a migrated-from node).
7. **Sequence steps** — cumulative impact and verdict after each step of the recommended order (and of `proposedOrder`, with the constraints it violates).
8. **Verdict explanation** — per change: standalone vs portfolio verdict, nodes gained/masked by the others, and, by **leave-one-out** over the combined set, which other change is decisive for each difference (or "jointly caused" when none is singly decisive).
9. **Hash** — FNV-1a 64 over the UTF-8 bytes of canonical JSON (sorted keys) of `{snapshotId, sorted changes, rules, depth, proposedOrder, result}`. Pure JS, 32-bit halves, no BigInt; a reproducibility id, not a cryptographic digest. Per-change results keep the engine's `stableHash` (a bit-identical fast replica is used).

## Complexity

With k ≤ 10 changes, one simulation is O(E·m + E log E + V) (m = migrate operations). The portfolio runs at most k individual + 1 combined + k leave-one-out + 2(k−2) prefix simulations (memoised), i.e. ≤ ~37 simulations, plus O(k²·ops) constraint derivation and O(k) SCC/topo sort.
Measured (test/portfolio.test.ts, this environment only): 10 changes on 50/100/200/1000 nodes (~3 edges/node) ≈ 20/30/50/210 ms.

## What it does NOT claim

- No probabilities, costs, effort or failure predictions. "Impacted" means *may be affected* according to recorded evidence.
- A migration (or a declared-compatible upgrade) is never proof that consumers actually moved; UNKNOWN dependencies are never migrated and are surfaced as gaps.
- Only one BFS witness path per impacted node is examined; UNKNOWN edges on alternative paths are not listed.
- Ordering constraints are structural heuristics derived from the graph, not a release plan; a cycle means the changes as scoped cannot be sequenced, not that they will fail.
- The snapshot is identified by `snapshotId` in the hash; snapshots are frozen by contract.
