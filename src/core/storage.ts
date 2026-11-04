/**
 * Storage error mapping for the app's key-value store (Forge KVS in production, composed in src/forge-adapters.ts).
 * Without it a KVS outage surfaced as INTERNAL "Unexpected server error." with retryable=false, telling clients not to retry
 * a transient infrastructure failure. Mapping (raw error details are never sent to the client):
 * - AppError: unchanged.
 * - KVS HTTP 429: RATE_LIMITED, retryable.
 * - KVS HTTP 5xx, or no HTTP status on a non-programming error (network reset, timeout): UPSTREAM_UNAVAILABLE, retryable.
 * - TypeError / RangeError / SyntaxError without status: rethrown unchanged = INTERNAL (a bug, not an outage).
 * - KVS HTTP 4xx (invalid key, payload too large, ...): rethrown unchanged = INTERNAL. That is a bug on our side, not an outage.
 * The workflow validator and the throttle keep their own outage handling (they catch every error).
 */
import { AppError } from './errors';
import type { Store } from './ports';

function statusOf(e: unknown): number | null {
  const s = (e as { responseDetails?: { status?: unknown } } | null)?.responseDetails?.status;
  return typeof s === 'number' ? s : null;
}

export function mapStorageError(e: unknown, op: string): unknown {
  if (e instanceof AppError) return e;
  const status = statusOf(e);
  if (status === 429) return new AppError('RATE_LIMITED', 'App storage is rate limited; try again shortly.', true, { storage: op });
  if (status !== null && status >= 500) return new AppError('UPSTREAM_UNAVAILABLE', 'App storage is temporarily unavailable; try again shortly.', true, { storage: op });
  // No HTTP status: only network-level failures are transient. Programming errors (TypeError, RangeError, e.g. an
  // unserializable value) are permanent and must not be advertised as retryable (red-team W3-4).
  if (status === null && !(e instanceof TypeError || e instanceof RangeError || e instanceof SyntaxError)) {
    return new AppError('UPSTREAM_UNAVAILABLE', 'App storage is temporarily unavailable; try again shortly.', true, { storage: op });
  }
  return e;
}

export function withStorageErrors(store: Store): Store {
  const guard = async <T>(op: string, run: () => Promise<T>): Promise<T> => {
    try { return await run(); } catch (e) { throw mapStorageError(e, op); }
  };
  return {
    get: (k) => guard('get', () => store.get(k)),
    set: (k, v) => guard('set', () => store.set(k, v)),
    setIfAbsent: (k, v) => guard('setIfAbsent', () => store.setIfAbsent(k, v)),
    delete: (k) => guard('delete', () => store.delete(k)),
    // Optional prefix query (decision radar); keep it optional so stores without it stay valid.
    ...(store.listByPrefix ? { listByPrefix: <T>(p: string, c?: string | null, l?: number) => guard('listByPrefix', () => store.listByPrefix!<T>(p, c, l)) } : {})
  };
}
