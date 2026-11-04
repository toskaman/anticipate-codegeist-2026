/**
 * Forge wiring of the shared decision workspace ops (behind capability flag sharedDecisions, off by default).
 * Registered from src/main.ts via registerWorkspaceResolvers(resolver, ...). Nothing here runs at import time.
 */
import api, { route } from '@forge/api';
import type { OperationName } from '../../packages/contracts/src/index';
import { AppError } from '../core/errors';
import { makeHandler, type HandlerOptions, type ResolverRequest } from '../core/handler';
import type { Store } from '../core/ports';
import { createWorkspaceOps, WORKSPACE_OPERATION_NAMES } from './ops';
import { storePlanReader } from './workspace';

/** Moved to ./workspace (the engine's execution gate needs it without @forge/api); re-exported for existing callers. */
export { storePlanReader };

/**
 * Live project permission of ANY account (not just the caller), checked as the app:
 * GET /rest/api/3/user/permission/search?accountId=&projectKey=&permissions= returns the account iff it holds the permission.
 * Fails closed: any non-200 answer throws (no permission is ever assumed).
 */
export async function forgeUserHasPermission(accountId: string, projectKey: string, permission: string): Promise<boolean> {
  const res = await api.asApp().requestJira(
    route`/rest/api/3/user/permission/search?accountId=${accountId}&projectKey=${projectKey}&permissions=${permission}&maxResults=1`,
    { headers: { Accept: 'application/json' } });
  if (res.status === 429) throw new AppError('RATE_LIMITED', 'Jira rate limit reached; try again shortly.', true);
  if (!res.ok) throw new AppError('UPSTREAM_UNAVAILABLE', `Jira permission check failed (HTTP ${res.status}).`, res.status >= 500);
  const users = (await res.json()) as { accountId?: string }[];
  return Array.isArray(users) && users.some((u) => u?.accountId === accountId);
}

export function registerWorkspaceResolvers(
  resolver: { define(name: string, fn: never): unknown },
  deps: { store: Store; now: () => Date; newId: () => string; globalPermissionsFor: (req: ResolverRequest) => (ps: string[]) => Promise<Record<string, boolean>>; throttle?: HandlerOptions['throttle'] }
) {
  const getPlan = storePlanReader(deps.store);
  for (const op of WORKSPACE_OPERATION_NAMES) {
    resolver.define(op, makeHandler(op as OperationName, () => 'LIVE', deps.newId, deps.now, (ctx, input, req) => {
      const ops = createWorkspaceOps({ store: deps.store, now: deps.now, newId: deps.newId, userHasPermission: forgeUserHasPermission, getPlan,
        globalPermissions: deps.globalPermissionsFor(req) }) as unknown as Record<string, (c: unknown, i: unknown) => Promise<unknown>>;
      return ops[op]!(ctx, input);
    }, deps.throttle ? { throttle: deps.throttle } : undefined) as never);
  }
}
