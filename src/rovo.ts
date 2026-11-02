/**
 * Read-only Rovo actions (usable by a rovo:agent and/or exposed as rovo:mcp tools).
 * They never write to Jira. Manifest wiring lives in docs/integrations/manifest-rovo.yml and is merged
 * only after the base app deploys successfully (Rovo MCP is Preview).
 */
import { createService } from './engine/service';
import { standardScenarios } from './engine/scenarios';
import { issueNodeId } from './jira/extractor';
import type { Deps } from './core/ports';
import { AppError } from './core/errors';

interface ActionPayload { issueKey?: string; replacementIssueKey?: string; planId?: string; context?: { accountId?: string; siteUrl?: string } }
const KEY = /^[A-Z][A-Z0-9_]+-[0-9]+$/;

export function createRovoActions(deps: (p: ActionPayload) => Deps) {
  const ctxOf = (p: ActionPayload) => ({ requestId: deps(p).newId(), accountId: p.context?.accountId ?? null, installationId: 'rovo' });
  const safe = (fn: (p: ActionPayload) => Promise<string>) => async (p: ActionPayload) => {
    try { return await fn(p ?? {}); } catch (e) { return `ANTICIPATE could not complete this request: ${e instanceof AppError ? `${e.code} — ${e.message}` : 'unexpected error'}.`; }
  };
  return {
    getGraph: safe(async (p) => {
      if (!p.issueKey || !KEY.test(p.issueKey)) throw new AppError('VALIDATION', 'issueKey must look like ABC-123');
      const svc = createService(deps(p));
      const g = await svc.getGraphSnapshot(ctxOf(p), { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA', maxDepth: 3 });
      const count = (s: string) => g.edges.filter((e) => e.status === s).length;
      return [`Evidence graph for ${p.issueKey} (snapshot ${g.snapshotId}, ${g.truncated ? 'truncated' : 'complete within limits'}):`,
        `${g.nodes.length} items, ${g.edges.length} relations — ${count('CONFIRMED')} confirmed, ${count('INFERRED')} inferred, ${count('UNKNOWN')} unknown.`,
        ...g.edges.filter((e) => e.kind === 'DEPENDS_ON' || e.kind === 'USES').slice(0, 20).map((e) => `- ${e.from.replace('issue:', '')} ${e.kind} ${e.to.replace('issue:', '')} [${e.status}]`)].join('\n');
    }),
    simulateRetirement: safe(async (p) => {
      if (!p.issueKey || !KEY.test(p.issueKey)) throw new AppError('VALIDATION', 'issueKey must look like ABC-123');
      const svc = createService(deps(p));
      const ctx = ctxOf(p);
      const g = await svc.getGraphSnapshot(ctx, { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA', maxDepth: 3 });
      const repl = p.replacementIssueKey && KEY.test(p.replacementIssueKey) && g.nodes.some((n) => n.id === issueNodeId(p.replacementIssueKey!)) ? issueNodeId(p.replacementIssueKey) : null;
      const c = await svc.compareScenarios(ctx, { snapshotId: g.snapshotId, change: { issueKey: p.issueKey, targetNodeId: issueNodeId(p.issueKey), description: `Retire ${p.issueKey}` },
        scenarios: standardScenarios(issueNodeId(p.issueKey), repl), maxDepth: 6 });
      return [`Counterfactual comparison for retiring ${p.issueKey} (deterministic, snapshot ${g.snapshotId}):`,
        ...c.results.map((r) => `- ${r.scenarioId}: ${r.verdict}; impacted ${r.summary.impacted} (${r.summary.direct} direct); blockers ${r.summary.blockers}; unknowns ${r.summary.unknowns}; rules ${r.violations.map((v) => v.ruleId).join(',') || 'none'}`),
        c.recommendedScenarioId ? `Lowest-risk now: ${c.recommendedScenarioId}. ${c.recommendationReason}` : c.recommendationReason,
        'No Jira changes were made. Open ANTICIPATE to review and approve a prevention plan.'].join('\n');
    }),
    getPassport: safe(async (p) => {
      if (!p.planId) throw new AppError('VALIDATION', 'planId is required');
      const pp = await createService(deps(p)).getPreventionPassport(ctxOf(p), { planId: p.planId });
      return [`Prevention Passport ${pp.passportId} (${pp.mode})`, `Plan status: ${pp.plan?.status ?? 'none'}`,
        `Executions: ${pp.executions.map((e) => `${e.actionId}=${e.status}`).join(', ') || 'none'}`, `Open unknowns: ${pp.openUnknowns.length}`, pp.disclaimer].join('\n');
    })
  };
}
