# Decision Radar: event-driven "needs review" signals for prevention plans

Status: design proposal answering contract request #132. Nothing here is implemented yet.
Docs accessed: 2026-11-03. Repo state: `main` at `39ccc3f`.

Note: I could not open the text of issue #132 from this session (GitHub API access to the repo was not enabled). Section (e) is based on the field list in the brief: monitoring availability, `lastObservedAt`, events with stable ids, reasons and cursor. Check it against the issue before implementing.

## Summary

- The narrow slice can ship **without new scopes**. Issue link created/deleted, issue deleted and version events all need `read:jira-work`, which the app already declares.
- The slice adds two manifest modules (`trigger` and `function`) and nothing else. It needs no queue, no scheduled trigger and no Jira REST call inside the handler.
- The radar can only raise a flag, never clear one. A missing event can never produce "all clear". `checkPlanFreshness`, which runs as the user and recomputes the plan, stays the only verdict and remains required before approval and execution (`guardFreshEvidence`).
- One design change from the brief: **link events carry issue IDs, not keys.** The index must be keyed by issue **id**, so `radar:idx:<issueId>:<planId>`, not `<issueKey>`. Plans therefore have to record the Jira issue ids of their evidence nodes, which today's snapshot does not store (see c.2).

---

## (a) Verified facts

Every item below comes from developer.atlassian.com unless marked otherwise. All pages were accessed on 2026-11-03.

### a.1 Jira product events
Source: https://developer.atlassian.com/platform/forge/events-reference/jira/

| Event | Payload (documented fields) | Scope |
|---|---|---|
| `avi:jira:created:issuelink`, `avi:jira:deleted:issuelink` | `eventType`, `selfGenerated`, `id` (link id), `sourceIssueId`, `destinationIssueId`, `sourceProjectId`, `destinationProjectId`, `issueLinkType` | `read:jira-work` |
| `avi:jira:deleted:issue` | `eventType`, `selfGenerated`, `issue`, `atlassianId?`, `associatedUsers?` | `read:jira-work` |
| `avi:jira:updated:issue` | `eventType`, `selfGenerated`, `jiraEventTypeName?`, `issue`, `atlassianId?`, `changelog`, `associatedUsers?`, `associatedStatuses?` | `read:jira-work` |
| `avi:jira:{created,updated,deleted,released,unreleased,archived,unarchived,moved,merged}:version` | `eventType`, `selfGenerated`, `version`, `mergedVersion?`, `atlassianId?` (deleted adds `newAffectsVersion?`, `newFixVersion?`, `customFieldReplacements`) | classic `read:jira-work` / granular `read:project-version:jira` |

- **A link event carries both issue ids** (`sourceIssueId`, `destinationIssueId`). It does **not** carry issue keys. Links are supported only within one Jira site.
- **Deleting an issue does not cascade.** The docs say "cascading events aren't emitted". Deleting an issue therefore does **not** emit `deleted:issuelink` for its links, so the radar must subscribe to `avi:jira:deleted:issue` separately.
- `issue updated` changelogs carry raw `from`/`to`. Readable strings are included only for a fixed list of fields, and labels are deliberately left out (PII).
- Every Jira event has a `timestamp` in epoch ms.
- I found **no documented event-unique id or delivery id** in the payload. The `id` on a link event is the *link* id.

### a.2 Trigger module
Source: https://developer.atlassian.com/platform/forge/manifest-reference/modules/trigger/

- Properties: `key`, `function` | `endpoint`, `events[]`, and optional `filter` with `appIsLicensed`, `ignoreSelf` and `expression`. `onError` applies only with `expression` and takes `IGNORE_AND_LOG` (default), `IGNORE`, `RECEIVE_AND_LOG` or `RECEIVE`. There is also `payload.include.propertyPaths` for entity properties.
- The filter is an `expression` over the event, not JQL. **There is no JQL filter on triggers.**
- Latency: "Events for `trigger` modules may take up to **3 minutes** to reach your app."

### a.3 Retries, size and identity for product events
Source: https://developer.atlassian.com/platform/forge/events-reference/product_events

- The app requests a retry by returning `InvocationError` (from `@forge/events`) with `retryAfter` (capped at 900 s), `retryReason` and `retryData` (4 KB max; ECO-734 says it must be an object). An event can be retried by the app **at most 4 times**. Retries carry `retryContext.retryCount`.
- The platform retries platform errors itself (`FUNCTION_OUT_OF_MEMORY`, `FUNCTION_TIME_OUT`, `FUNCTION_PLATFORM_RATE_LIMITED` and `FUNCTION_PLATFORM_UNKNOWN_ERROR`). The docs do not give the number of platform retries.
- **Events larger than 200 kB are not delivered** ("may change without notice").
- `asApp()` sees everything the app may see, regardless of restrictions. `asUser(accountId)` needs `allowImpersonation: true` on the scopes, plus an accountId from the payload (for example `event.atlassianId`). Link events do not list `atlassianId`.
- Self-generated events have `selfGenerated: true` unless `ignoreSelf` filters them out.

### a.4 Execution identity
Source: https://developer.atlassian.com/platform/forge/events/

- Event-invoked code "runs under the identity of the app system user, rather than an Atlassian interactive user account".

### a.5 Invocation limits
Source: https://developer.atlassian.com/platform/forge/limits-invocation/

- General runtime is 25 s ("Runtime seconds"). The page does not name product-event triggers explicitly, so **assume 25 s** for the trigger handler.
- Functions referenced only by `consumer` or `scheduledTrigger` modules default to 55 s and can be raised to 900 s with `timeoutSeconds`.
- Memory: up to 1024 MB, which the app already sets.
- Network: 100,000 requests per minute per app per tenant.

### a.6 Async events (`@forge/events` Queue)
Sources:
- https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api
- https://developer.atlassian.com/platform/forge/limits-async-events/
- https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api-version-2-upgrade/
- https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api-error-handling/

- Delivery is **at-least-once** within the retention window. Successfully enqueued events are "guaranteed to be delivered". **No ordering guarantee** is documented.
- Retention is 24 h, extended by up to 72 h for platform errors (96 h total). Retries use exponential backoff up to about 15 min apart. In v2 they continue until retention expires, instead of the v1 limit of 4.
- `delayInSeconds` ranges from 0 to 900.
- Limits: 50 events per push, 200 KB per push request, **500 events per minute per installation**, 4 KB `retryData`, and 1,000 cyclic push requests from one initial invocation.
- The handler receives `jobId` and `retryContext`. An optional `concurrency { key, limit }` applies per installation.

### a.7 Scheduled triggers
Source: https://developer.atlassian.com/platform/forge/manifest-reference/modules/scheduled-trigger/

- Intervals are `fiveMinute`, `hour`, `day` and `week`, with at most 5 scheduled triggers per app.
- There is **no retry** when a run throws, and a "small chance of duplicated invocations".
- There is no user context.
- Redeploying a changed scheduled trigger resets its start times.

### a.8 KVS
Sources:
- https://developer.atlassian.com/platform/forge/storage-reference/kvs-api/
- https://developer.atlassian.com/platform/forge/storage-reference/kvs-api-query/
- https://developer.atlassian.com/platform/forge/storage-reference/kvs/

- `kvs.set(k, v, { keyPolicy: 'FAIL_IF_EXISTS', ttl: { unit, value } })` is the documented "set if absent". The repo already wraps it as `forgeStore.setIfAbsent` in `src/forge-adapters.ts`.
- TTL can be at most 1 year. **Deletion of expired keys is asynchronous and can take up to 48 h**, and reads may still return expired values. Request `EXPIRE_TIME` metadata if expiry must be strict.
- `kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(n).cursor(c).getMany()`:
  - `beginsWith` on the key is **the only condition**, and a query can have one `where`.
  - `limit` defaults to 10 and can be at most 100.
  - `nextCursor` paginates, but the docs say **"do not persist cursors"**.
  - Ordering and consistency are not documented.
- KVS and Custom Entities "don't support indexing of arbitrary attributes". The recommended approach is to design keys so that related records share a prefix.
- Key character rules, size limits and storage quotas are on https://developer.atlassian.com/platform/forge/platform-quotas-and-limits/#storage-limits. **I did not fetch that page.** The existing keys already use `:` (`plan:`, `exec:<p>:<a>`), so colon-separated keys are known to work in this app.

### a.9 Community and secondary evidence (not a guarantee, context only)

- https://jira.atlassian.com/browse/ECO-1403: Forge `avi:confluence:updated:page` events arrived about 70 minutes late and out of order. It was closed as Fixed on 2026-06-09, with no explanation. This shows that delay and reordering have happened in practice.

---

## (b) What cannot be guaranteed, and how the radar stays honest

| Risk | Basis | Consequence |
|---|---|---|
| Missed event | No documented delivery guarantee for **product** events, only for async queue events. Retries are bounded (4 app retries, platform count undocumented). Events over 200 kB are dropped. | The radar can be silently blind. |
| Delay | Up to 3 min documented; about 70 min observed (ECO-1403). | A flag may arrive after the user has opened the plan. |
| Reordering | Not documented for product events. Explicitly no ordering for async events. | A `created` event may arrive after the matching `deleted`. |
| Duplicates | Implied by retries; documented for scheduled triggers. | The same fact may be processed twice. |
| No cascade | Issue delete does not emit link-deleted. | We must subscribe to `deleted:issue`. |
| Coverage gaps | (1) Nodes that the snapshot only knows by key (`not_crawled`, `UNKNOWN`) have no id to index. (2) Changes beyond the crawl frontier that `checkPlanFreshness` would see (new 2-hop edges) are not covered. (3) Issue moves and key changes, status or field edits and version events are out of the first slice. | A radar hit is only a hint that something changed; the absence of hits proves nothing. |
| Quiet versus broken | A site with no link activity looks the same as a broken subscription. | We cannot show "monitoring healthy" from silence. |

### Honesty rules (normative)

1. **Monitoring state** for each installation, with an optional per-plan `coverage`:
   - `NOT_CONFIGURED`: no trigger is deployed, or the plan has no indexed evidence ids (for example legacy plans).
   - `ACTIVE`: the trigger is deployed, the plan is indexed, and the last handler run did not record an error.
   - `DEGRADED`: the handler recorded an error (dropped write, fan-out cap hit, retry exhausted), the plan is only partly indexed (some evidence nodes have no id), or the index write failed. Every `DEGRADED` state carries a machine reason.
   - `ACTIVE` never means "fresh". It means only "listening, no known faults".
2. Always expose `lastObservedAt`, the time of the last event the handler processed for this installation, and `lastEvaluatedAt` per plan. The UI says "No radar alerts since <t>. This is not a freshness check." It never shows a green "all clear".
3. **The radar is monotonic.** It may move a plan to `NEEDS_REVIEW`. Only a user-run `checkPlanFreshness` (as the user, with the full recompute) may clear the flag. A `deleted` event never cancels an earlier `created` flag.
4. **No auto-execution and no auto-invalidation by the radar.** Changing plan status to `INVALIDATED` stays in `checkPlanFreshness` and `guardFreshEvidence`, which already block approval and execution on drift.
5. If an attention list is truncated, it says so (`truncated: true`) and does not drop items silently.

---

## (c) First slice design

### c.1 Flow

```
Jira ── avi:jira:created:issuelink ┐
     ── avi:jira:deleted:issuelink ├─► trigger radarOnJiraEvent (asApp identity, NO Jira calls)
     ── avi:jira:deleted:issue    ─┘        │
                                            ├─ 1. normalise -> RadarFact {factId, type, issueIds[], linkId?, linkTypeName?, occurredAt}
                                            ├─ 2. dedupe: setIfAbsent("radar:seen:<factId>", 1, ttl 7d) -> if false: return (duplicate)
                                            ├─ 3. for each issueId: kvs.query(beginsWith "radar:idx:<issueId>:") limit 100, paginate
                                            ├─ 4. for each planId hit (cap 200/event, else DEGRADED + reason FANOUT_CAPPED):
                                            │      append fact to "radar:att:<planId>" (bounded list, max 50, oldest dropped -> truncated)
                                            └─ 5. update "radar:health" {lastObservedAt, lastError?}
UI open plan ─► getPlanAttention(planId) (owner-only, like loadPlan) ─► "Needs review: link changed between PAY-1 and an issue outside this plan's evidence"
              ─► user clicks "Re-check now" ─► checkPlanFreshness (asUser) ─► clears radar:att on success, or INVALIDATED on drift
```

### c.2 Index (the key design change)

- **Key:** `radar:idx:<issueId>:<planId>`, with value `{ planId, issueKey, role: 'EVIDENCE' }` and a TTL equal to the plan retention (90 d, see `retentionFor`).
  - One key per pair, so there is no contended list document.
  - The lookup is a single `beginsWith` prefix query, which KVS supports (a.8).
  - The trailing `:` in the prefix stops `idx:1001` from matching `idx:10010`.
- **Why id and not key:** link events carry only `sourceIssueId` and `destinationIssueId`. Ids also survive issue moves, which change the key.
- **Writing the index:** when a plan is generated, or at the latest when it is approved, write one key per readable `ISSUE`/`TEST` evidence node.
  - The ids come from the extractor. `RawIssue.id` is already fetched in `src/forge-adapters.ts`, but the extractor (`src/jira/extractor.ts`) does not keep it.
  - Additive change: put `attributes.jiraId` on each node, which the existing `attributes` record already allows.
  - Store `evidenceIssueIds: Record<issueKey, issueId>` on the `PlanRec` itself, because snapshots expire after 2 days and plans after 90.
  - Nodes without an id (UNKNOWN or not crawled) are counted in `coverage.unindexedNodes`. If that count is above 0, the plan's monitoring is `DEGRADED` with reason `PARTIAL_INDEX`.
- **Removing the index:** delete the keys when the plan reaches a terminal state (COMPLETED, FAILED, EXPIRED or INVALIDATED). TTL is the backstop.
- **Write budget:** one `batchSet` per plan (≤ ~100 keys for typical plans, up to `maxNodes`). If a write fails, the plan's monitoring is `DEGRADED` with reason `INDEX_WRITE_FAILED`. Plan creation does not fail.

### c.3 Dedupe and fact id

The platform gives no event id (a.1), so we derive one from the payload.

- Links: `factId = sha256("<eventType>|<link id>")`. Each link id is created once and deleted once, so this is stable across redeliveries and distinct for a re-created link, which gets a new link id.
- Issue deleted: `factId = sha256("deleted:issue|<issue.id>")`.
- Dedupe uses `setIfAbsent('radar:seen:<factId>', …, ttl 7 d)`. `retentionFor` needs a `radar:seen:` rule.
- **Partial failure:** dedupe is written *after* the attention writes succeed, and attention appends are idempotent by `factId` (set semantics). A crash between the two steps leads to a harmless re-append that set semantics absorb. The alternative, dedupe first, could lose the fact on a crash. We pick at-least-once.

### c.4 Attention record (no data the viewer cannot read)

- **Key:** `radar:att:<planId>`, value:

  ```
  { planId, status: 'NEEDS_REVIEW', firstAt, lastAt, truncated,
    facts: [{ factId, type: 'LINK_CREATED'|'LINK_DELETED'|'ISSUE_DELETED',
              occurredAt, observedAt, evidenceIssueKeys: string[], externalEndpoint: boolean, linkTypeName?: string }] }
  ```

- **What it may contain:** only facts the plan owner already saw.
  - `evidenceIssueKeys` are keys **from the plan's own `evidenceIssueIds` map** (the owner saw them when building the plan). They are never resolved through Jira as the app.
  - The other end of a link, if it is not in the plan's evidence, is shown only as `externalEndpoint: true`. We store **no id, key, summary or project** for it, because the owner may not be able to see that issue and the trigger runs as the app (a.4).
  - `linkTypeName` comes from the payload's `issueLinkType`. Link type names are site configuration rather than issue content. **Open question:** confirm the exact shape of `issueLinkType` (an id or an object with a name). If unsure, store nothing.
- **Access:** reads go through an owner check equivalent to `loadPlan` (plans are private to their creator). So the trigger never exposes anything to a viewer. The attention record is read only when the owner opens the plan.
- **What the trigger never does:** call Jira, change plan `status`, invalidate or execute. Plan `status` is unchanged, and `NEEDS_REVIEW` is a separate attention flag next to it.
- **Clearing:** `checkPlanFreshness` deletes `radar:att:<planId>` when it returns `fresh: true`. If it returns not fresh, the existing invalidation path applies and the attention record stays as history until the plan is terminal.

### c.5 Fan-out bound

- In the first slice, everything happens inline in the trigger:
  - ≤ 2 issue ids per event
  - ≤ 2 pages of 100 index keys each
  - ≤ 200 attention writes
- This fits easily in 25 s. If more than 200 plans are hit, the trigger marks the first 200 and records `DEGRADED` with reason `FANOUT_CAPPED` in `radar:health`. It does not pretend to have covered the rest.
- Slice 2 (only if measured need): push the remaining plan ids to a `radar-fanout` queue, 50 per push, within the 500 events per minute limit (a.6). Queue delivery is at-least-once with retries, which is stronger than inline. There is also a `day` scheduled trigger that sweeps orphaned or expired index keys. Neither is in slice 1.

### c.6 `ignoreSelf`

- **Do not** set `ignoreSelf: true` in slice 1.
- It is not documented whether links created by `executeApprovedPlan`, which writes **asUser**, count as `selfGenerated`. If they do, `ignoreSelf` would also hide changes made by *another* plan's execution.
- Instead, read `selfGenerated` and treat it as a fact, and let `checkPlanFreshness` ignore plan artifacts as it already does (`planArtifactIssueKeys`).

### c.7 Out of scope for slice 1

- `updated:issue` (status or field drift), version events, issue move/key change, and Confluence.
- Push notifications or email.
- Any automatic action.

---

## (d) Manifest and scopes

**No scope changes.** Every event used needs `read:jira-work`, which is already declared. The app needs no `allowImpersonation`, because the handler makes no Jira calls.

Add under `modules:`:

```yaml
  trigger:
    - key: anticipate-decision-radar
      function: radarOnJiraEvent
      events:
        - avi:jira:created:issuelink
        - avi:jira:deleted:issuelink
        - avi:jira:deleted:issue
      filter:
        appIsLicensed: true
```

Add under `modules.function:`:

```yaml
    - key: radarOnJiraEvent
      handler: index.radarOnJiraEvent
```

`permissions.scopes` stays exactly as it is:

```yaml
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - read:jira-user
    - storage:app
```

Notes:

- `appIsLicensed: true` is the minimum valid filter, since a filter needs at least one property. **On an unlicensed or development install it suppresses events.** Drop the whole `filter` block for development and staging if that turns out to be a problem.
- An `expression` filter to limit projects is possible but not proposed. Plans can span projects, and a wrong expression fails closed under the default `IGNORE_AND_LOG`.
- Slice 2 only, not now: add `consumer` (`queue: radar-fanout`) plus a function with `timeoutSeconds`, and optionally a `scheduledTrigger` (`interval: day`). These need no new scopes either.
- Any manifest change that adds a trigger needs a redeploy. The docs I read do not say whether adding a trigger with existing scopes requires admins to re-consent. My expectation is that it does not, because the scopes are unchanged, but this is **unverified**.

---

## (e) Contract proposal for #132

These are additive zod schemas in `packages/contracts/src/index.ts`.

```ts
export const MonitoringState = z.enum(['NOT_CONFIGURED', 'ACTIVE', 'DEGRADED']);
export const RadarReason = z.enum([
  'LINK_CREATED', 'LINK_DELETED', 'ISSUE_DELETED',          // attention reasons
]);
export const MonitoringFault = z.enum([
  'PARTIAL_INDEX', 'INDEX_WRITE_FAILED', 'FANOUT_CAPPED', 'HANDLER_ERROR', 'LEGACY_PLAN_NOT_INDEXED'
]);

export const RadarEvent = z.object({
  eventId: z.string().max(80),            // stable: derived factId (sha256 of eventType|link id / issue id), identical across redeliveries
  reason: RadarReason,
  occurredAt: IsoDate,                    // from payload timestamp
  observedAt: IsoDate,                    // when our handler processed it
  evidenceIssueKeys: z.array(z.string().max(50)).max(2), // ONLY keys already in this plan's evidence
  externalEndpoint: z.boolean(),          // other end not in evidence; never identified
  selfGenerated: z.boolean()
});

export const PlanAttention = z.object({
  planId: Id,
  monitoring: z.object({
    state: MonitoringState,
    faults: z.array(MonitoringFault).max(10),
    lastObservedAt: IsoDate.nullable(),   // installation-wide: last event processed by the radar
    indexedIssueCount: z.number().int().nonnegative(),
    unindexedIssueCount: z.number().int().nonnegative()
  }),
  needsReview: z.boolean(),               // true iff events.length > 0 since last successful freshness check
  lastFreshnessCheckAt: IsoDate.nullable(),
  events: z.array(RadarEvent).max(50),
  truncated: z.boolean(),
  page: z.object({ nextCursor: z.string().nullable() }), // opaque, server-issued (offset into the plan's fact list), NOT a KVS cursor (docs: don't persist)
  disclaimer: z.literal('Radar alerts are hints; only a freshness check confirms evidence.')
});
```

Other contract changes:

- Operation `getPlanAttention({ planId, cursor })`, owner-only.
- `CapabilityAvailability` gets `decisionRadar: CapabilityState`.
  - It is `AVAILABLE` only when the trigger is deployed, and the `ACTIVE`/`DEGRADED` detail is carried in `PlanAttention.monitoring`.
  - That keeps the existing `CapabilityState` enum unchanged.
- **Ordering:** events are sorted by `occurredAt`, then `eventId`, with no claim that this is delivery order. A `LINK_DELETED` that sorts before its `LINK_CREATED` is shown as is. Both mean "needs review".
- **No `allClear` or `fresh` field** in this contract on purpose. Freshness stays `EvidenceDrift.fresh` from `checkPlanFreshness`.

---

## (f) Test plan

### Unit tests (pure, with the in-memory `Store` fake)

1. Normalising a link-created payload gives the expected `factId`, both issue ids and `selfGenerated`. Unknown or extra fields are ignored. Missing `sourceIssueId` gives no-op and a `HANDLER_ERROR` fault, with no throw loop.
2. **Duplicate delivery:** the same payload delivered twice produces 1 fact on the plan and 1 `radar:seen`. A third delivery that carries `retryContext` is also a no-op.
3. **Reordered events:** `deleted` for link L is delivered before `created` for link L. Result:
   - two facts with distinct ids
   - `needsReview` is true
   - the order follows `occurredAt`
   - nothing cancels anything else
4. **Re-created link:** create L1, delete L1, create L2 (same issues). This gives three facts. The dedupe must not collapse L2 into L1.
5. **Issue deleted without link events** (no cascade): the plan that indexed that issue is flagged `ISSUE_DELETED`.
6. **Leak tests:**
   - Link between evidence issue A (key `PAY-1`) and a non-evidence issue with id 99999: the stored fact contains `PAY-1` and `externalEndpoint: true`, and the serialised record contains no `99999` and no summary text.
   - A link between two non-indexed issues writes nothing.
7. **Owner isolation:** `getPlanAttention` from a non-owner returns `PERMISSION_DENIED`, matching `loadPlan`.
8. **Monotonic:**
   - The radar never changes `plan.status`.
   - Only `checkPlanFreshness` returning `fresh: true` clears attention.
   - On drift it invalidates, and attention stays.
9. **Fan-out cap:** 250 indexed plans for one issue gives 200 flagged and `FANOUT_CAPPED` in health. The response for an unflagged plan shows `DEGRADED`, never `ACTIVE`.
10. **Partial index:** a plan with one `not_crawled` node shows `DEGRADED` / `PARTIAL_INDEX`.
11. **Crash between attention write and dedupe write:** the redelivery re-appends idempotently, with no duplicate fact.
12. **Prefix collision:** an index key for issue `1001` is not returned for issue `10010`.
13. **KVS key contract:** extend the existing KVS key-contract test (commit `51989ab`) with the `radar:idx:`, `radar:att:`, `radar:seen:` and `radar:health` prefixes and their `retentionFor` TTLs.

### Live and dev-site tests (manual or E2E)

14. Create a `blocks` link from an evidence issue: the flag appears in ≤ 3 min. Record the observed latency.
15. Delete the link, then the issue: two more facts appear.
16. A restricted project, where the owner has no access and the issue is linked to an evidence issue: the UI shows only "an issue outside this plan's evidence".
17. Redeploy, then check that `lastObservedAt` is preserved and that the monitoring state is honest before the first event arrives.
18. Uninstall, then reinstall: the old index is gone or expired, and plans show `NOT_CONFIGURED` until re-indexed.

---

## (g) Open questions and items I could not verify

1. The **exact text of #132.** I could not read the issue from this session.
2. **Delivery guarantee for product events.** No developer.atlassian.com page states at-least-once, ordering or a platform retry count for product-event triggers. The design assumes neither.
3. **Trigger timeout:** the docs do not name this module type, and I assume the general 25 s. Confirm the value, or route through a queue if the work grows.
4. **Whether `selfGenerated` is true for `asUser` writes** made by the app (decides `ignoreSelf`).
5. The **shape of `issueLinkType`** in link events (id only, or an object with a name), and whether the `deleted:issue` payload's `issue` always includes `id` and `key`. The docs list the field but I did not see its sub-schema.
6. **KVS key rules and limits** (allowed characters, maximum key length, value size, write rate per installation). The quotas page was not fetched. `radar:idx:<numericId>:<uuid>` is short and uses only characters the app already uses.
7. **Whether adding a `trigger` module** with unchanged scopes needs admin re-consent or a major-version upgrade.
8. Whether to **index the replacement or "other" issues** that a plan targets (actions), and not only the snapshot evidence nodes.
9. **Health without events:** is a cheap heartbeat worth it, for example a `day` scheduled trigger that records "radar process alive"? It proves only that the function runs, not that Jira events reach it, so it must not upgrade the state to "healthy".
10. **Retention:** do facts follow the plan TTL (90 d) or a shorter one? They are evidence metadata (issue keys only), so 90 d matches the audit trail.
11. **`appIsLicensed: true`** suppresses events on unlicensed dev installs. Decide per environment.
