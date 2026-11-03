/**
 * Per-user/per-installation application throttle (sliding-window log).
 *
 * WHY STORE, NOT LOCAL MEMORY (decision, with proof):
 * Forge resolvers run as stateless serverless functions (see manifest.yml `function:` entries:
 * `resolver`, `rovo*`, `validateTransition`). Each invocation may land on a fresh isolate, so an
 * in-memory Map would only limit requests within one warm isolate and could be bypassed entirely
 * by concurrent or sequential invocations on other isolates. All cross-request state in this app
 * (snap:/plan:/exec:/lock:/idem:) already lives in the Store port (Forge KVS in production,
 * `forgeStore` in src/forge-adapters.ts) for exactly this reason — throttle counters join it.
 *
 * ALGORITHM: sliding-window log. The store holds, per key, the epoch-ms timestamps of recent
 * allowed requests. On check, entries older than `windowMs` are pruned; the request is allowed
 * iff fewer than `limit` entries remain. Simple, exact, and race-tolerant (a lost update only
 * over-admits by the racing requests, never blocks legitimate ones).
 *
 * CONSUMER BACKOFF (documented contract): a rejection carries `retryAfterMs` (also surfaced as
 * `details.retryAfterMs` on the RATE_LIMITED envelope by src/core/handler.ts). Clients MUST wait
 * at least `retryAfterMs` before retrying, and on repeated rejections SHOULD apply exponential
 * backoff with jitter (e.g. min(retryAfterMs * 2^attempt, 60s) + random(0..1s)).
 *
 * LIMITS (known, accepted):
 * - Read-modify-write is not atomic (Store has no incr): under heavy concurrency the effective
 *   limit may overshoot by the number of racing invocations. This errs toward availability.
 * - Store entries self-prune by window, but the keys themselves follow the default retention of
 *   `forgeStore` (currently 90 days, like audit keys) because `retentionFor` has no throttle
 *   prefix. Touching it is out of scope; entries are tiny (<= limit timestamps each).
 * - Identity falls back to `installationId` alone when `accountId` is null (e.g. validator with
 *   no end-user context); such callers share one budget per installation.
 */
import type { Store } from './ports';

export interface ThrottleOptions {
  /** Max allowed requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Clock injection (tests). Defaults to Date.now. */
  now?: () => number;
}

/** Production default: generous per-operation budget; abuse control, not UX friction. */
export const DEFAULT_THROTTLE: Readonly<Required<Pick<ThrottleOptions, 'limit' | 'windowMs'>>> = {
  limit: 60,
  windowMs: 60_000
};

export interface ThrottleIdentity { installationId: string; accountId: string | null; }

export interface ThrottleVerdict {
  allowed: boolean;
  /** 0 when allowed; otherwise ms until the oldest entry slides out (client MUST wait this long). */
  retryAfterMs: number;
  /** Remaining budget in the current window (0 when rejected). */
  remaining: number;
}

/** Stable store key: budget is per (installation, user, operation). */
export function throttleKey(installationId: string, accountId: string | null, operation: string): string {
  return `throttle:${installationId}:${accountId ?? 'anon'}:${operation}`;
}

type ThrottleState = number[]; // epoch-ms of allowed requests, ascending

export async function checkThrottle(
  store: Store, identity: ThrottleIdentity, operation: string, opts: ThrottleOptions
): Promise<ThrottleVerdict> {
  if (!Number.isInteger(opts.limit) || opts.limit <= 0) throw new Error(`throttle: limit must be a positive integer, got ${opts.limit}.`);
  if (!Number.isInteger(opts.windowMs) || opts.windowMs <= 0) throw new Error(`throttle: windowMs must be a positive integer, got ${opts.windowMs}.`);
  const now = opts.now?.() ?? Date.now();
  const key = throttleKey(identity.installationId, identity.accountId, operation);
  const stored = await store.get<ThrottleState>(key);
  const recent = (Array.isArray(stored) ? stored : []).filter((t): t is number => typeof t === 'number' && t > now - opts.windowMs);
  if (recent.length >= opts.limit) {
    const oldest = recent[0]!;
    return { allowed: false, retryAfterMs: Math.max(1, oldest + opts.windowMs - now), remaining: 0 };
  }
  const next = [...recent, now];
  await store.set(key, next);
  return { allowed: true, retryAfterMs: 0, remaining: opts.limit - next.length };
}

/** Signature the handler accepts, so wiring stays decoupled from storage details. */
export type ThrottleCheck = (identity: ThrottleIdentity, operation: string) => Promise<ThrottleVerdict>;

/** Binds a Store + options into the single function `makeHandler` needs. */
export function createStoreThrottle(store: Store, opts: ThrottleOptions & { now?: () => number }): ThrottleCheck {
  return (identity, operation) => checkThrottle(store, identity, operation, opts);
}
