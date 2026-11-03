/** Wraps a use-case as a resolver: input validation, request IDs, response envelope, error redaction, structured logs. */
import { CONTRACT_VERSION, OPERATIONS, type OperationName } from '../../packages/contracts/src/index';
import { AppError } from './errors';
import type { Ctx } from './ports';
import type { ThrottleCheck } from './throttle';

export interface HandlerOptions {
  /**
   * Optional per-user/per-installation throttle (see src/core/throttle.ts).
   * Checked AFTER input validation (bad payloads never consume budget) and BEFORE execution.
   * Omitted = no application-level limiting (existing behaviour, e.g. tests).
   */
  throttle?: ThrottleCheck;
}

/** Hard input bound applied BEFORE schema validation (mitigates GHSA-mrhx-c7xc-m3w5 in zod 3: oversized collections). */
export const MAX_PAYLOAD_CHARS = 64_000;

export interface ResolverRequest { payload?: unknown; context?: { accountId?: string; installContext?: string; localId?: string; siteUrl?: string } }

export function makeHandler<N extends OperationName>(
  name: N, mode: () => 'LIVE' | 'DEMO_FIXTURE', newId: () => string, now: () => Date,
  run: (ctx: Ctx, input: never, req: ResolverRequest) => Promise<unknown>,
  opts?: HandlerOptions
) {
  return async (req: ResolverRequest) => {
    const requestId = newId();
    let dataMode: 'LIVE' | 'DEMO_FIXTURE' | null = null;
    const meta = () => ({ contractVersion: CONTRACT_VERSION, requestId, mode: dataMode ?? mode(), generatedAt: now().toISOString() });
    const started = Date.now();
    try {
      let size = Infinity;
      try { size = JSON.stringify(req.payload ?? {}).length; } catch { /* cyclic or unserializable => rejected */ }
      if (size > MAX_PAYLOAD_CHARS) throw new AppError('VALIDATION', `Request payload too large (limit ${MAX_PAYLOAD_CHARS} characters).`);
      const parsed = OPERATIONS[name].input.safeParse(req.payload ?? {});
      if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      const ctx: Ctx = { requestId, accountId: req.context?.accountId ?? null, installationId: req.context?.installContext ?? 'unknown' };
      if (opts?.throttle) {
        const verdict = await opts.throttle({ installationId: ctx.installationId, accountId: ctx.accountId }, name);
        if (!verdict.allowed) {
          throw new AppError('RATE_LIMITED',
            `Rate limit exceeded for ${name}; retry in ${Math.ceil(verdict.retryAfterMs / 1000)}s.`,
            true, { retryAfterMs: verdict.retryAfterMs });
        }
      }
      const data = await run(ctx, parsed.data as never, req);
      const out = OPERATIONS[name].output.safeParse(data);
      if (!out.success) throw new AppError('INTERNAL', `Output contract violation in ${name}.`, false, { issue: out.error.issues[0]?.path.join('.') });
      if (isDemo(out.data)) dataMode = 'DEMO_FIXTURE';
      log('info', { op: name, requestId, ms: Date.now() - started });
      return { ok: true, meta: meta(), data: out.data };
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError('INTERNAL', 'Unexpected server error.');
      log(err.code === 'INTERNAL' ? 'error' : 'warn', { op: name, requestId, code: err.code, ms: Date.now() - started, detail: e instanceof Error ? e.message.slice(0, 200) : undefined });
      return { ok: false, meta: meta(), error: { code: err.code, message: err.message, requestId, retryable: err.retryable, ...(err.details ? { details: err.details } : {}) } };
    }
  };
}

/** No payloads, tokens or Jira content in logs. */
function log(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  console[level](JSON.stringify({ app: 'anticipate', ...fields }));
}

/** Any response carrying demo-fixture content is labelled DEMO_FIXTURE in meta, never LIVE. */
function isDemo(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return o.mode === 'DEMO_FIXTURE' || (typeof o.snapshotId === 'string' && o.snapshotId.startsWith('snap-fixture'));
}
