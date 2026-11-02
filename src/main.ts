import Resolver from '@forge/resolver';
import type { OperationName } from '../packages/contracts/src/index';
import { makeHandler, type ResolverRequest } from './core/handler';
import { createService } from './engine/service';
import { createForgeJira, forgeStore } from './forge-adapters';

const resolver = new Resolver();
const now = () => new Date();
const newId = () => globalThis.crypto.randomUUID();

const service = (req: ResolverRequest) => createService({ jira: createForgeJira(req.context?.siteUrl ?? null), store: forgeStore, now, newId });
type Svc = ReturnType<typeof createService>;

const ops: OperationName[] = ['getCapabilities', 'getPolicies', 'listProjects', 'getChangeCandidates', 'getGraphSnapshot', 'getEvidenceGraph', 'simulateChange',
  'compareScenarios', 'generatePreventionPlan', 'approvePlan', 'executeApprovedPlan', 'getExecutionStatus', 'getPreventionPassport', 'checkPlanFreshness', 'previewSampleProject', 'createSampleProject'];

for (const op of ops) {
  resolver.define(op, makeHandler(op, () => 'LIVE', newId, now, (ctx, input, req) => {
    const svc = service(req) as unknown as Record<string, (c: unknown, i: unknown) => Promise<unknown>>;
    return svc[op]!(ctx, input);
  }) as never);
}

// Legacy template resolver kept so an older frontend build does not break.
resolver.define('getText', () => 'Hello, world!');

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

export { diagnostics, seedDemo } from './diagnostics';

// ---- Jira workflow validator (opt-in per workflow transition) ----
import { decideTransition, type DecisionRecord } from './validator';
export async function validateTransition(args: { issue?: { key?: string } }) {
  const key = args?.issue?.key;
  if (!key) return { result: true };
  try {
    const jira = createForgeJira(null, 'app');
    const issue = await jira.getIssue(key);
    const decision = await forgeStore.get<DecisionRecord>(`decision:${key}`);
    return decideTransition(issue.kind === 'ok' ? issue.issue : null, decision, key);
  } catch (e) {
    console.warn(JSON.stringify({ app: 'anticipate', op: 'validateTransition', failOpen: true, detail: e instanceof Error ? e.message.slice(0, 200) : 'error' }));
    return { result: true };
  }
}
