/**
 * Read-only Rovo actions (usable by a rovo:agent and/or exposed as rovo:mcp tools).
 * They never write to Jira. Manifest wiring lives in docs/integrations/manifest-rovo.yml and is merged
 * only after the base app deploys successfully (Rovo MCP is Preview).
 */
import { createService } from './engine/service';
import { standardScenarios, upgradeScenarios } from './engine/scenarios';
import { issueNodeId } from './jira/extractor';
import type { Deps } from './core/ports';
import { AppError } from './core/errors';
import { MAX_PAYLOAD_CHARS } from './core/handler';
import { createStoreThrottle, DEFAULT_THROTTLE, type ThrottleCheck } from './core/throttle';
import { slipFromJira, formatSlip } from './engine/slip-service';
import { portfolioReport, PORTFOLIO_LIMITS } from '../packages/simulation-core/src/portfolio';
import type { PortfolioChange } from '../packages/contracts/src/index';

interface ActionPayload { days?: number | string; changes?: unknown; issueKey?: string; replacementIssueKey?: string; planId?: string; context?: { accountId?: string; siteUrl?: string; principal?: { accountId?: string } } }
interface ActionContext { accountId?: string; principal?: { accountId?: string } }
/** Forge may deliver the invoking user in the payload context or in the second handler argument. The handler argument wins: payload context is caller-influenced and must never override platform-provided identity. */
export const actorOf = (p: ActionPayload, c?: ActionContext): string | null =>
  c?.principal?.accountId ?? c?.accountId ?? p?.context?.accountId ?? p?.context?.principal?.accountId ?? null;
const KEY = /^[A-Z][A-Z0-9_]+-[0-9]+$/;
/** Pure validators: run pre-throttle (mirroring makeHandler's validate-before-throttle) and re-used in-body. */
const needIssueKey: (p: ActionPayload) => asserts p is ActionPayload & { issueKey: string } = (p) => { if (!p.issueKey || !KEY.test(p.issueKey)) throw new AppError('VALIDATION', 'issueKey must look like ABC-123'); };
const needPlanId: (p: ActionPayload) => asserts p is ActionPayload & { planId: string } = (p) => { if (!p.planId) throw new AppError('VALIDATION', 'planId is required'); };
const slipDays = (p: ActionPayload): number => {
  // Coerce Forge string payloads, then fail fast before any auth/service call.
  const raw: unknown = p.days;
  const days = typeof raw === 'string' ? Number(raw.trim()) : raw;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) throw new AppError('VALIDATION', 'days must be an integer between 1 and 365');
  return days;
};

/** Max characters of the Rovo/MCP `changes` text (10 clauses comfortably fit). */
export const PORTFOLIO_CHANGES_MAX_CHARS = 1000;
const PORTFOLIO_GRAMMAR = 'REMOVE KEY | DEPRECATE KEY | UPGRADE KEY [breaking|compatible] | MIGRATE KEY TO KEY, separated by ";" (for example "REMOVE MP-5; UPGRADE MP-9 breaking; MIGRATE MP-5 TO MP-7")';
const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,19}-[0-9]{1,9}$/;

/**
 * Strict, bounded parser for the Rovo/MCP portfolio input. The text is data, never instructions: anything that is not
 * exactly one of the clauses of PORTFOLIO_GRAMMAR is rejected (offending text is not echoed back).
 * Each clause becomes one change with id c1..cN and its canonical text as label.
 */
export function parsePortfolioChanges(text: unknown): PortfolioChange[] {
  if (typeof text !== 'string' || !text.trim()) throw new AppError('VALIDATION', `changes is required: ${PORTFOLIO_GRAMMAR}`);
  if (text.length > PORTFOLIO_CHANGES_MAX_CHARS) throw new AppError('VALIDATION', `changes must be at most ${PORTFOLIO_CHANGES_MAX_CHARS} characters`);
  const clauses = text.split(/[;\n]/).map((c) => c.trim()).filter((c) => c.length > 0);
  if (clauses.length === 0) throw new AppError('VALIDATION', `changes is required: ${PORTFOLIO_GRAMMAR}`);
  if (clauses.length > PORTFOLIO_LIMITS.maxChanges) throw new AppError('VALIDATION', `at most ${PORTFOLIO_LIMITS.maxChanges} changes are allowed (got ${clauses.length})`);
  const bad = (i: number): never => { throw new AppError('VALIDATION', `change ${i + 1} is not understood. Use ${PORTFOLIO_GRAMMAR}`); };
  const key = (t: string | undefined, i: number) => (t !== undefined && ISSUE_KEY.test(t) ? t : bad(i));
  return clauses.map((clause, i): PortfolioChange => {
    const t = clause.split(/[ \t]+/);
    const verb = t[0]!.toUpperCase();
    const id = `c${i + 1}`;
    if ((verb === 'REMOVE' || verb === 'DEPRECATE') && t.length === 2) {
      const k = key(t[1], i);
      return { id, label: `${verb} ${k}`, operations: [verb === 'REMOVE' ? { op: 'REMOVE_NODE', nodeId: issueNodeId(k) } : { op: 'DEPRECATE_NODE', nodeId: issueNodeId(k), retainUntil: null }] };
    }
    if (verb === 'UPGRADE' && (t.length === 2 || t.length === 3)) {
      const k = key(t[1], i);
      const flag = (t[2] ?? 'breaking').toLowerCase();
      if (flag !== 'breaking' && flag !== 'compatible') bad(i);
      return { id, label: `UPGRADE ${k} ${flag}`, operations: [{ op: 'UPGRADE_NODE', nodeId: issueNodeId(k), breaking: flag === 'breaking' }] };
    }
    if (verb === 'MIGRATE' && t.length === 4 && (t[2]!.toUpperCase() === 'TO' || t[2] === '->')) {
      const from = key(t[1], i); const to = key(t[3], i);
      if (from === to) bad(i);
      return { id, label: `MIGRATE ${from} TO ${to}`, operations: [{ op: 'MIGRATE_DEPENDENTS', fromNodeId: issueNodeId(from), toNodeId: issueNodeId(to), edgeKinds: ['USES', 'DEPENDS_ON'] }] };
    }
    return bad(i);
  });
}

export interface RovoOptions {
  /** Abuse envelope override (tests inject small budgets). Default: production throttle on the action store. */
  throttle?: ThrottleCheck;
}

export function createRovoActions(deps: (p: ActionPayload) => Deps, opts?: RovoOptions) {
  let defaultCheck: ThrottleCheck | null = null;
  const checkOf = (p: ActionPayload) => opts?.throttle ?? (defaultCheck ??= createStoreThrottle(deps(p).store, DEFAULT_THROTTLE));
  const ctxOf = (p: ActionPayload, c?: ActionContext) => ({ requestId: deps(p).newId(), accountId: actorOf(p, c), installationId: 'rovo' });
  /** Abuse envelope, mirroring makeHandler order: payload bound, then throttle, then execution. Invalid payloads never reach Jira. Rovo handlers carry no install context, so the budget is per invoking user (abuse control, not accounting). */
  const guard = async (action: string, p: ActionPayload, c?: ActionContext) => {
    let size = Infinity;
    try { size = JSON.stringify(p ?? {}).length; } catch { /* cyclic or unserializable => rejected */ }
    if (size > MAX_PAYLOAD_CHARS) throw new AppError('VALIDATION', `Request payload too large (limit ${MAX_PAYLOAD_CHARS} characters).`);
    const verdict = await checkOf(p)({ installationId: 'rovo', accountId: actorOf(p, c) }, `rovo:${action}`);
    if (!verdict.allowed) throw new AppError('RATE_LIMITED', `Rate limit exceeded for ${action}; retry in ${Math.ceil(verdict.retryAfterMs / 1000)}s.`, true, { retryAfterMs: verdict.retryAfterMs });
  };
  const safe = (action: string, validate: (p: ActionPayload) => unknown, fn: (p: ActionPayload, c?: ActionContext) => Promise<string>) => async (p: ActionPayload, c?: ActionContext) => {
    try { const payload = p ?? {}; validate(payload); await guard(action, payload, c); return await fn(payload, c); } catch (e) { return `ANTICIPATE could not complete this request: ${e instanceof AppError ? `${e.code} — ${e.message}` : 'unexpected error'}.`; }
  };
  return {
    getGraph: safe('getGraph', needIssueKey, async (p, c) => {
      needIssueKey(p);
      const svc = createService(deps(p));
      const g = await svc.getGraphSnapshot(ctxOf(p, c), { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA', maxDepth: 3 });
      const count = (s: string) => g.edges.filter((e) => e.status === s).length;
      return [`Evidence graph for ${p.issueKey} (snapshot ${g.snapshotId}, ${g.truncated ? 'truncated' : 'complete within limits'}):`,
        `${g.nodes.length} items, ${g.edges.length} relations — ${count('CONFIRMED')} confirmed, ${count('INFERRED')} inferred, ${count('UNKNOWN')} unknown.`,
        ...g.edges.filter((e) => e.kind === 'DEPENDS_ON' || e.kind === 'USES').slice(0, 20).map((e) => `- ${e.from.replace('issue:', '')} ${e.kind} ${e.to.replace('issue:', '')} [${e.status}]`)].join('\n');
    }),
    simulateRetirement: safe('simulateRetirement', needIssueKey, async (p, actx) => {
      needIssueKey(p);
      const svc = createService(deps(p));
      const ctx = ctxOf(p, actx);
      const g = await svc.getGraphSnapshot(ctx, { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA', maxDepth: 3 });
      const repl = p.replacementIssueKey && KEY.test(p.replacementIssueKey) && g.nodes.some((n) => n.id === issueNodeId(p.replacementIssueKey!)) ? issueNodeId(p.replacementIssueKey) : null;
      const c = await svc.compareScenarios(ctx, { snapshotId: g.snapshotId, change: { issueKey: p.issueKey, targetNodeId: issueNodeId(p.issueKey), description: `Retire ${p.issueKey}` },
        scenarios: standardScenarios(issueNodeId(p.issueKey), repl), maxDepth: 6 });
      return [`Counterfactual comparison for retiring ${p.issueKey} (deterministic, snapshot ${g.snapshotId}):`,
        ...c.results.map((r) => `- ${r.scenarioId}: ${r.verdict}; impacted ${r.summary.impacted} (${r.summary.direct} direct); blockers ${r.summary.blockers}; unknowns ${r.summary.unknowns}; open questions ${r.uncertainties.map((u) => u.reason).join(',') || 'none'}; rules ${r.violations.map((v) => v.ruleId).join(',') || 'none'}`),
        c.recommendedScenarioId ? `Lowest-risk now: ${c.recommendedScenarioId}. ${c.recommendationReason}` : c.recommendationReason,
        'No Jira changes were made. Open ANTICIPATE to review and approve a prevention plan.'].join('\n');
    }),
    simulateUpgrade: safe('simulateUpgrade', needIssueKey, async (p, actx) => {
      needIssueKey(p);
      const svc = createService(deps(p));
      const ctx = ctxOf(p, actx);
      const g = await svc.getGraphSnapshot(ctx, { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA', maxDepth: 3 });
      const repl = p.replacementIssueKey && KEY.test(p.replacementIssueKey) && g.nodes.some((n) => n.id === issueNodeId(p.replacementIssueKey!)) ? issueNodeId(p.replacementIssueKey) : null;
      const c = await svc.compareScenarios(ctx, { snapshotId: g.snapshotId, change: { issueKey: p.issueKey, targetNodeId: issueNodeId(p.issueKey), description: `Upgrade ${p.issueKey}` },
        scenarios: upgradeScenarios(issueNodeId(p.issueKey), repl), maxDepth: 6 });
      return [`Counterfactual comparison for upgrading ${p.issueKey} (deterministic, snapshot ${g.snapshotId}):`,
        ...c.results.map((r) => `- ${r.scenarioId}: ${r.verdict}; impacted ${r.summary.impacted} (${r.summary.direct} direct); blockers ${r.summary.blockers}; unknowns ${r.summary.unknowns}; open questions ${r.uncertainties.map((u) => u.reason).join(',') || 'none'}; rules ${r.violations.map((v) => v.ruleId).join(',') || 'none'}`),
        c.recommendedScenarioId ? `Lowest-risk now: ${c.recommendedScenarioId}. ${c.recommendationReason}` : c.recommendationReason,
        'No Jira changes were made.'].join('\n');
    }),
    simulateSlip: safe('simulateSlip', (p) => { needIssueKey(p); slipDays(p); }, async (p, c) => {
      needIssueKey(p);
      const days = slipDays(p);
      return formatSlip(await slipFromJira(deps(p).jira, ctxOf(p, c), { issueKey: p.issueKey, days }));
    }),
    simulatePortfolio: safe('simulatePortfolio', (p) => { needIssueKey(p); parsePortfolioChanges(p.changes); }, async (p, c) => {
      needIssueKey(p);
      // Parse (strict, bounded) before any auth/service call.
      const changes = parsePortfolioChanges(p.changes);
      const r = await createService(deps(p)).simulatePortfolio(ctxOf(p, c), { projectId: p.issueKey.split('-')[0]!, rootIssueKey: p.issueKey, source: 'JIRA',
        snapshotMaxDepth: 3, snapshotId: null, changes, maxDepth: 6, proposedOrder: null });
      const comb = r.combined.result;
      return [`Portfolio what-if around ${p.issueKey} (deterministic, snapshot ${r.snapshot.snapshotId}${r.snapshot.truncated ? ', truncated' : ''}, result hash ${r.resultHash}):`,
        ...changes.map((x) => `- ${x.id}: ${x.label}`),
        `Combined verdict: ${comb.verdict}; impacted ${comb.summary.impacted} (${comb.summary.direct} direct); blockers ${comb.summary.blockers}; unknowns ${comb.summary.unknowns}; conflicts ${r.conflicts.length}.`,
        r.ordering.order ? `Recommended order: ${r.ordering.order.join(' -> ')}` : `No valid order: cyclic constraints ${r.ordering.cycles.map((g) => `{${g.join(', ')}}`).join(' ')}`,
        '', portfolioReport(r), '',
        'No Jira changes were made. Structural evidence only; changes require explicit human approval inside the ANTICIPATE app.'].join('\n');
    }),
    checkFreshness: safe('checkFreshness', needPlanId, async (p, c) => {
      needPlanId(p);
      const d = await createService(deps(p)).checkPlanFreshness(ctxOf(p, c), { planId: p.planId });
      const fmt = (e: { from: string; kind: string; to: string; status: string }) => `- ${e.from.replace('issue:', '')} ${e.kind} ${e.to.replace('issue:', '')} [${e.status}]`;
      return [`Evidence freshness for plan ${d.planId} (snapshot ${d.snapshotId}, checked ${d.checkedAt}): ${d.fresh ? 'FRESH' : 'CHANGED'}`, d.reason,
        ...(d.addedEdges.length ? ['New relations:', ...d.addedEdges.map(fmt)] : []),
        ...(d.removedEdges.length ? ['Removed relations:', ...d.removedEdges.map(fmt)] : []),
        ...(d.becameUnknown.length ? [`No longer readable: ${d.becameUnknown.join(', ')}`] : []),
        'Freshness check. A stale APPROVED plan is marked INVALIDATED; execution of a changed or invalidated plan is blocked server-side until a new plan is reviewed.'].join('\n');
    }),
    getPassport: safe('getPassport', needPlanId, async (p, c) => {
      needPlanId(p);
      const pp = await createService(deps(p)).getPreventionPassport(ctxOf(p, c), { planId: p.planId });
      return [`Prevention Passport ${pp.passportId} (${pp.mode})`, `Plan status: ${pp.plan?.status ?? 'none'}`,
        `Executions: ${pp.executions.map((e) => `${e.actionId}=${e.status}`).join(', ') || 'none'}`, `Open unknowns: ${pp.openUnknowns.length}`, pp.disclaimer].join('\n');
    })
  };
}
