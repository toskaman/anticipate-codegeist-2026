import Resolver from '@forge/resolver';
import type { OperationName } from '../packages/contracts/src/index';
import { makeHandler, type ResolverRequest } from './core/handler';
import { createStoreThrottle, DEFAULT_THROTTLE } from './core/throttle';
import { createService } from './engine/service';
import { createForgeJira, forgeQueryStore, forgeStore } from './forge-adapters';
import { createRadar, eventShape } from './radar/radar';
import { createWorkspace } from './workspace/workspace';
import { forgeUserHasPermission, storePlanReader } from './workspace/forge';
import { registerWorkspaceResolvers } from './workspace/forge';

const resolver = new Resolver();
const now = () => new Date();
const newId = () => globalThis.crypto.randomUUID();

// Shared-decision execution gate: always wired, whatever the feature flag, so a plan shared earlier stays governed.
const sharedDecisions = createWorkspace({ store: forgeStore, now, newId, userHasPermission: forgeUserHasPermission, getPlan: storePlanReader(forgeStore) });
const radar = createRadar({ store: forgeQueryStore, now });
const service = (req: ResolverRequest) => createService({ jira: createForgeJira(req.context?.siteUrl ?? null), store: forgeStore, now, newId, sharedDecisions, radar });

/** Forge trigger (Decision Radar): Jira issue-link created/deleted and issue deleted. Runs as the app, no Jira call. */
export async function radarOnJiraEvent(event: unknown) {
  const r = await radar.onEvent(event);
  console.log(JSON.stringify({ app: 'anticipate', op: 'radarOnJiraEvent', status: r.status, plans: r.plans, capped: r.capped,
    ...(r.status === 'IGNORED' ? { shape: eventShape(event) } : {}) }));
  return r;
}
type Svc = ReturnType<typeof createService>;
const throttle = createStoreThrottle(forgeStore, DEFAULT_THROTTLE);

const ops: OperationName[] = ['getCapabilities', 'getPolicies', 'listProjects', 'getChangeCandidates', 'getGraphSnapshot', 'getEvidenceGraph', 'simulateChange',
  'compareScenarios', 'generatePreventionPlan', 'approvePlan', 'executeApprovedPlan', 'getExecutionStatus', 'getPreventionPassport', 'checkPlanFreshness', 'previewSampleProject', 'createSampleProject', 'getValidatorPolicy', 'setValidatorPolicy', 'simulateSlip', 'simulatePortfolio', 'getPlanAttention', 'getReleaseSafety', 'getDecisionHistory', 'composeSafeChanges'];

for (const op of ops) {
  resolver.define(op, makeHandler(op, () => 'LIVE', newId, now, (ctx, input, req) => {
    const svc = service(req) as unknown as Record<string, (c: unknown, i: unknown) => Promise<unknown>>;
    return svc[op]!(ctx, input);
  }, { throttle }) as never);
}

// Shared decision workspace: resolver ops exist, but every op refuses with FEATURE_DISABLED until a site admin
// enables the sharedDecisions flag (decision D3: off until a hosted two-account test passes).
registerWorkspaceResolvers(resolver, { store: forgeStore, now, newId, throttle,
  globalPermissionsFor: (req) => (ps) => createForgeJira(req.context?.siteUrl ?? null).globalPermissions(ps) });

export const handler = resolver.getDefinitions();
export type { Svc };

// ---- Rovo actions (read-only). Exported for manifest wiring in docs/integrations/manifest-rovo.yml ----
import { createRovoActions } from './rovo';
const rovo = createRovoActions((p) => ({ jira: createForgeJira(p.context?.siteUrl ?? null), store: forgeStore, now, newId }));
export const rovoGetGraph = rovo.getGraph;
export const rovoSimulateRetirement = rovo.simulateRetirement;
export const rovoSimulateUpgrade = rovo.simulateUpgrade;
export const rovoGetPassport = rovo.getPassport;
export const rovoCheckFreshness = rovo.checkFreshness;
export const rovoSimulateSlip = rovo.simulateSlip;
export const rovoSimulatePortfolio = rovo.simulatePortfolio;

// ---- Jira workflow validator (opt-in per workflow transition) ----
import { runValidator, type DecisionRecord } from './validator';
import { VALIDATOR_POLICY_KEY } from './engine/service';
export async function validateTransition(args: { issue?: { key?: string } }) {
  const key = args?.issue?.key;
  const jira = createForgeJira(null, 'app');
  // No issue key = no evidence: follow the outage policy instead of passing silently (audit #1).
  return runValidator(key ?? '(unknown issue)', {
    readIssue: (k) => (key ? jira.getIssue(k) : Promise.resolve({ kind: 'no_issue_key' })),
    // Legacy discovery by design: at gating time only the issue key is known, so the gate follows the
    // latest decision recorded for the issue (last-writer-wins mirror). Records themselves are scoped per
    // owner+plan since TOP7 (no cross-owner clobbering); owner-scoped gating needs product semantics for
    // which owner's plan should gate an issue — see follow-up issue. Never pass a scope derived from the record.
    readDecision: (k) => forgeStore.get<DecisionRecord>(`decision:${k}`),
    readPolicy: () => forgeStore.get<{ onOutage?: string }>(VALIDATOR_POLICY_KEY),
    log: (f) => console.warn(JSON.stringify(f))
  });
}
