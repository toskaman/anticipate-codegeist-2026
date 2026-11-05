# ADR: Forge KVS transactions for the shared-decision workspace

Date: 5 Nov 2026 · Decision: **KEEP THE EXISTING DESIGN** (setIfAbsent claims, derived state). Shared Decisions stays release-locked.

## Evidence (installed SDK, `@forge/kvs` 2.1.1, read from `node_modules/@forge/kvs/out`)
- `kvs.transact()` exists. It returns a `TransactionBuilder` with `set`, `delete`, `check` and `execute`.
- `set(key, value, entity?, options?)`: `options` is `SetOptions = { ttl }`. There is **no `keyPolicy`**, so a transactional set cannot express FAIL_IF_EXISTS.
- `check(key, { entityName, conditions })`: conditions are **Custom Entity** filters. Plain key-value records cannot be checked.
- The operation and payload limits (25 operations, 4 MB) come from the Atlassian docs. They were **not re-verified** at runtime here.

## Consequences for our records
- **Approval slot claim:** `ws:slot:<id>:<n>` plus the approver marker. It needs "create only if absent" on two plain keys. A transaction can't express that, so it would be no safer than today's ordered setIfAbsent pair.
- **Terminal marker:** `ws:term:<id>`, first writer wins. setIfAbsent already does this atomically.
- **Audit sequence keys:** setIfAbsent per sequence key. Already append-only.
- A transactional design would mean migrating these records to Custom Entities, with a data migration, a new failure mode (whole-transaction conflicts and retries), and no correctness gain we can show.

## Not conflated
Jira REST mutations are never part of a KVS transaction. Execution stays lease-protected, idempotent per action and verified by read-back.

## Revisit when
The SDK adds key policies or conditions on plain keys inside transactions, or we move workspace records to Custom Entities for another reason.
