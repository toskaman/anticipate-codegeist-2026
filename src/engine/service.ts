import { slipFromJira } from './slip-service';
import { aggregateRelease } from './release';
import { RELEASE_SAFETY_LIMITS, type ReleaseSafety } from '../../packages/contracts/src/index';
/**
 * ANTICIPATE backend use-cases. Pure orchestration over ports (Jira, Store, clock, ids).
 * Every mutation of Jira requires: stored plan, matching approval (plan hash), fresh snapshot, live permission check,
 * a per-plan lease, per-action idempotent reconciliation, and post-write verification.
 */
import type {
  CapabilityAvailability, ExecutionRecord, GraphSnapshot, JiraIssueSummary, PreventionPassport, PreventionPlan,
  ProjectSummary, ScenarioComparison, SimulationRequest, ApprovalRequest, ProposedAction
} from '../../packages/contracts/src/index';
import { compareScenarios as compare, simulate } from '../../packages/simulation-core/src/index';
import { FIXTURE_SNAPSHOT } from '../../packages/contracts/src/fixtures';
import { AppError, fail } from '../core/errors';
import type { Ctx, Deps, JiraIssue } from '../core/ports';
import { extractGraph, issueNodeId } from '../jira/extractor';
import { DEFAULT_POLICIES } from './policies';
import { actionMarker, buildPlan } from './plans';
import { diffEvidence } from './drift';
import { previewSample, createSample } from './sample';
import { mergeSource, notConfiguredTwg } from '../context/sources';
import type { EvidenceDrift, PlanAttention } from '../../packages/contracts/src/index';
import { stableHash } from '../../packages/simulation-core/src/index';
import { simulatePortfolio as runPortfolio, PortfolioError, PORTFOLIO_LIMITS } from '../../packages/simulation-core/src/portfolio';
import type { SimulatePortfolioRequest, SimulatePortfolioResult, ChangeOperation } from '../../packages/contracts/src/index';
import { ATTESTATION_VALID_DAYS, decideTransition, decisionKey, linksDigest, type DecisionRecord } from '../validator';

export const CHANGE_LABEL = 'anticipate-change';
export const VALIDATOR_POLICY_KEY = 'config:validator';
const SNAPSHOT_TTL_HOURS = 24;
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 5;

interface SnapRec { snapshot: GraphSnapshot; owner: string | null; rootIssueKey: string; projectKey: string; }
interface CmpRec { request: SimulationRequest; comparison: ScenarioComparison; }
interface PlanRec { plan: PreventionPlan; owner: string | null; rootIssueKey: string; projectKey: string; approvedActionIds: string[];
  approvals: { accountId: string | null; at: string; actionIds: string[]; planHash: string }[]; timeline: { at: string; event: string }[]; }

/**
 * Minimized provenance kept for the plan's retention period (90 days) so a Prevention Passport stays reviewable after the
 * full snapshot (2 days) is gone. It holds only identifiers, counts and the causal edges reviewed; no issue text.
 */
interface ProvRec { owner: string | null; snapshotId: string; mode: GraphSnapshot['mode']; capturedAt: string; expiresAt: string;
  nodeCount: number; edgeCount: number; causalEdges: { from: string; to: string; kind: string; status: string }[]; snapshotDigest: string; }

const K = {
  prov: (planId: string) => `prov:${planId}`,
  snap: (id: string) => `snap:${id}`, cmp: (id: string) => `cmp:${id}`, plan: (id: string) => `plan:${id}`,
  exec: (p: string, a: string) => `exec:${p}:${a}`, lock: (p: string) => `lock:${p}`, idem: (k: string) => `idem:${k}`
};

export function createService(d: Deps) {
  const iso = () => d.now().toISOString();

  async function loadSnap(ctx: Ctx, snapshotId: string): Promise<SnapRec> {
    if (snapshotId === FIXTURE_SNAPSHOT.snapshotId) return { snapshot: FIXTURE_SNAPSHOT, owner: null, rootIssueKey: 'PAY-412', projectKey: 'DEMO' };
    if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
    const r = await d.store.get<SnapRec>(K.snap(snapshotId));
    if (!r) fail('NOT_FOUND', `Snapshot ${snapshotId} not found.`);
    if (r!.owner !== ctx.accountId) fail('PERMISSION_DENIED', 'Snapshots are private to the user who created them.');
    return r!;
  }
  const isExpired = (s: GraphSnapshot) => s.mode === 'LIVE' && new Date(s.expiresAt).getTime() < d.now().getTime();

  async function loadPlan(ctx: Ctx, planId: string): Promise<PlanRec> {
    if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
    const r = await d.store.get<PlanRec>(K.plan(planId));
    if (!r) fail('NOT_FOUND', `Plan ${planId} not found.`);
    if (r!.owner !== ctx.accountId) fail('PERMISSION_DENIED', 'Plans are private to the user who created them.');
    return r!;
  }

  const toSummary = (i: JiraIssue): JiraIssueSummary => ({
    id: i.id, key: i.key, summary: i.summary.slice(0, 1000), status: i.status, issueType: i.issueType, projectId: i.projectId, updatedAt: normalizeDate(i.updated),
    url: d.jira.siteUrl() ? `${d.jira.siteUrl()!.replace(/\/$/, '')}/browse/${i.key}` : null
  });

  /** Latest decision state per owner+plan (scoped attestation) plus a deprecated per-issue mirror — read by the Jira workflow validator (no crawl at transition time). */
  async function recordDecision(rec: PlanRec) {
    const cmp = await d.store.get<CmpRec>(K.cmp(`plan:${rec.plan.planId}`));
    const chosen = cmp?.comparison.results.find((x) => x.scenarioId === rec.plan.scenarioId);
    const r: DecisionRecord = { schema: 3, planId: rec.plan.planId, scenarioId: rec.plan.scenarioId, status: rec.plan.status, at: iso(),
      issueKey: rec.rootIssueKey, owner: rec.owner, planHash: rec.plan.planHash, snapshotId: rec.plan.snapshotId, linksDigest: null, validUntil: null,
      verdict: chosen?.verdict ?? 'UNKNOWN', blockers: chosen?.summary.blockers ?? null,
      allActionsVerified: rec.plan.status === 'COMPLETED' };
    if (rec.plan.status === 'COMPLETED') {
      // A scenario can PASS because it ASSUMES work (e.g. "migrate consumers first"). Re-evaluate the change itself
      // (the scenario without its MIGRATE assumptions) on the live Jira evidence: the gate opens only if the change
      // is not blocked by what is in Jira now. Issues created by this plan are excluded (they are the plan's own work items).
      try {
        const scen = cmp?.request.scenarios.find((s) => s.scenarioId === rec.plan.scenarioId);
        const direct = (scen?.operations ?? []).filter((o) => o.op !== 'MIGRATE_DEPENDENTS');
        if (direct.length) {
          const live = await extractGraph(d.jira, rec.rootIssueKey, { maxDepth: 3, maxNodes: 200, snapshotId: `${rec.plan.snapshotId}~attest`,
            projectId: rec.projectKey, now: d.now(), ttlHours: SNAPSHOT_TTL_HOURS });
          const creates = rec.plan.actions.filter((a) => a.type === 'CREATE_ISSUE');
          const artifacts = creates.length ? (await d.jira.searchIssues(`labels in (${creates.map((a) => `"${actionMarker(rec.plan.planId, a.actionId)}"`).join(', ')})`, null, 50)).items.map((i) => `issue:${i.key}`) : [];
          const g = { ...live, edges: live.edges.filter((e) => !artifacts.includes(e.from) && !artifacts.includes(e.to)) };
          const now = simulate(g, { scenarioId: `${rec.plan.scenarioId}~as-is`, label: 'change on current evidence', operations: direct }, DEFAULT_POLICIES);
          r.currentVerdict = now.verdict; r.currentBlockers = now.summary.blockers;
        } else { r.currentVerdict = chosen?.verdict ?? 'UNKNOWN'; r.currentBlockers = chosen?.summary.blockers ?? null; }
      } catch { r.currentVerdict = 'UNKNOWN'; r.currentBlockers = null; }
      // Attest the links as they are AFTER verified execution (the plan's own new links included). Unreadable => no attestation.
      const f = await d.jira.getIssue(rec.rootIssueKey).catch(() => null);
      if (f?.kind === 'ok') {
        r.linksDigest = linksDigest(f.issue.links);
        r.validUntil = new Date(d.now().getTime() + ATTESTATION_VALID_DAYS * 86_400_000).toISOString();
      }
    }
    await d.store.set(decisionKey(rec.owner ?? 'unknown', rec.rootIssueKey, rec.plan.planId), r);
    // Deprecated migration mirror: the workflow wiring still reads the legacy per-issue key.
    await d.store.set(`decision:${rec.rootIssueKey}`, r);
  }

  /** Evidence behind a plan: the live snapshot if still retained, otherwise the minimized provenance record. */
  async function loadEvidence(ctx: Ctx, rec: PlanRec) {
    if (rec.plan.snapshotId === FIXTURE_SNAPSHOT.snapshotId) { const s = await loadSnap(ctx, rec.plan.snapshotId); return { mode: s.snapshot.mode, state: 'LIVE' as const, prov: null }; }
    const snap = await d.store.get<SnapRec>(K.snap(rec.plan.snapshotId));
    const prov = await d.store.get<ProvRec>(K.prov(rec.plan.planId));
    const owner = snap?.owner ?? prov?.owner;
    if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
    if (!snap && !prov) fail('NOT_FOUND', 'The evidence for this plan is no longer retained.');
    if (owner !== ctx.accountId) fail('PERMISSION_DENIED', 'Decision records are private to the user who created them.');
    if (snap) return { mode: snap.snapshot.mode, state: isExpired(snap.snapshot) ? 'EXPIRED_SNAPSHOT' as const : 'LIVE' as const, prov };
    return { mode: prov!.mode, state: 'ARCHIVED' as const, prov };
  }

  /** Re-extract the plan's evidence neighbourhood live and diff it (Continuous Decision Safety). */
  async function evidenceDrift(rec: PlanRec, snap: SnapRec): Promise<EvidenceDrift> {
    const checkedAt = iso();
    if (snap.snapshot.mode !== 'LIVE') return diffEvidence({ planId: rec.plan.planId, before: snap.snapshot, after: snap.snapshot, planArtifactIssueKeys: [], checkedAt });
    const after = await extractGraph(d.jira, snap.rootIssueKey, { maxDepth: snap.snapshot.limits.maxDepth, maxNodes: snap.snapshot.limits.maxNodes,
      snapshotId: `${snap.snapshot.snapshotId}~recheck`, projectId: snap.snapshot.projectId, now: d.now(), ttlHours: SNAPSHOT_TTL_HOURS });
    const records = await Promise.all(rec.plan.actions.map((a) => d.store.get<ExecutionRecord>(K.exec(rec.plan.planId, a.actionId))));
    const creates = rec.plan.actions.filter((a) => a.type === 'CREATE_ISSUE');
    const fromRecords = records.filter((r) => r?.resultRef?.issueKey && creates.some((a) => a.actionId === r.actionId)).map((r) => r!.resultRef!.issueKey!);
    // Bookkeeping can be lost (timeouts); marker labels on created issues are the durable source of truth.
    let fromMarkers: string[] = [];
    if (creates.length) {
      const labels = creates.map((a) => `"${actionMarker(rec.plan.planId, a.actionId)}"`).join(', ');
      fromMarkers = (await d.jira.searchIssues(`labels in (${labels})`, null, 50)).items.map((i) => i.key);
    }
    const artifacts = [...new Set([...fromRecords, ...fromMarkers])].sort();
    return diffEvidence({ planId: rec.plan.planId, before: snap.snapshot, after, planArtifactIssueKeys: artifacts, checkedAt });
  }

  async function guardFreshEvidence(rec: PlanRec, snap: SnapRec, stage: 'approval' | 'execution') {
    const drift = await evidenceDrift(rec, snap);
    if (drift.fresh) return;
    rec.plan = { ...rec.plan, status: 'EVIDENCE_CHANGED' };
    rec.timeline.push({ at: iso(), event: `Evidence changed before ${stage}: ${drift.reason}`.slice(0, 200) });
    await d.store.set(K.plan(rec.plan.planId), rec);
    await recordDecision(rec);
    throw new AppError('EVIDENCE_CHANGED', drift.reason, false, { addedEdges: drift.addedEdges, removedEdges: drift.removedEdges, becameUnknown: drift.becameUnknown });
  }

  return {
    /** Validator outage policy. Default ALLOW (never lock a workflow because ANTICIPATE is down). Only Jira site admins can change it. */
    /** Read-only what-if: dates and releases that move if an issue slips (see slip-service). */
    async simulateSlip(ctx: Ctx, input: { issueKey: string; days: number }) { return slipFromJira(d.jira, ctx, input); },
    async getValidatorPolicy(ctx: Ctx) {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      const cur = await d.store.get<{ onOutage: 'ALLOW' | 'BLOCK'; updatedBy: string | null; updatedAt: string | null }>(VALIDATOR_POLICY_KEY);
      const canEdit = !!(await d.jira.globalPermissions(['ADMINISTER']))['ADMINISTER'];
      return { onOutage: cur?.onOutage ?? 'ALLOW', updatedBy: cur?.updatedBy ?? null, updatedAt: cur?.updatedAt ?? null, canEdit };
    },

    async setValidatorPolicy(ctx: Ctx, input: { onOutage: 'ALLOW' | 'BLOCK' }) {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      if (!(await d.jira.globalPermissions(['ADMINISTER']))['ADMINISTER']) fail('PERMISSION_DENIED', 'Only Jira administrators can change the validator outage policy.');
      const rec = { onOutage: input.onOutage, updatedBy: ctx.accountId, updatedAt: iso() };
      await d.store.set(VALIDATOR_POLICY_KEY, rec);
      console.warn(JSON.stringify({ app: 'anticipate', op: 'setValidatorPolicy', onOutage: input.onOutage, accountId: ctx.accountId }));
      return { ...rec, canEdit: true };
    },

    async previewSampleProject(_ctx: Ctx, input: { projectKey: string }) { return previewSample(d.jira, input.projectKey, d.now()); },

    async createSampleProject(ctx: Ctx, input: { projectKey: string; confirm: true }) {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'Creating sample data requires an authenticated Atlassian user.');
      // One creator per project at a time: concurrent clicks / retried requests must not create duplicate sample issues.
      const lockKey = `lock:sample:${input.projectKey}`;
      const lease = { until: d.now().getTime() + LEASE_MS, token: d.newId() };
      if (!(await d.store.setIfAbsent(lockKey, lease))) {
        const cur = await d.store.get<typeof lease>(lockKey);
        if (cur && cur.until > d.now().getTime()) fail('CONFLICT', 'Sample data is already being created for this project. Preview again in a few seconds to see progress.');
        if (!(await d.store.setIfAbsent(`lock-takeover:sample:${input.projectKey}:${cur?.token ?? 'missing'}`, lease.token))) fail('CONFLICT', 'Another request is creating sample data.');
        await d.store.set(lockKey, lease);
      }
      try { return await createSample(d.jira, input.projectKey, d.now()); }
      finally { const held = await d.store.get<typeof lease>(lockKey); if (held?.token === lease.token) await d.store.delete(lockKey); }
    },

    async checkPlanFreshness(ctx: Ctx, input: { planId: string }): Promise<EvidenceDrift> {
      const rec = await loadPlan(ctx, input.planId);
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      const drift = await evidenceDrift(rec, snap);
      // Active invalidation (TOP9): an APPROVED plan whose evidence changed must never execute. Mark it
      // INVALIDATED now (persisted + attested); any other status stays read-only here.
      if (!drift.fresh && rec.plan.status === 'APPROVED') {
        rec.plan = { ...rec.plan, status: 'INVALIDATED' };
        rec.timeline.push({ at: iso(), event: `Plan invalidated: evidence changed after approval: ${drift.reason}`.slice(0, 200) });
        await d.store.set(K.plan(rec.plan.planId), rec);
        await recordDecision(rec);
      }
      // Only a successful user-run recompute may clear radar attention (the radar itself is monotonic).
      if (drift.fresh && d.radar) { try { await d.radar.clear(rec.plan.planId); } catch { /* attention stays raised: safe */ } }
      return drift;
    },

    /** Decision Radar attention for a plan the caller owns. A hint, never a verdict (see src/radar/radar.ts). */
    async getPlanAttention(ctx: Ctx, input: { planId: string }): Promise<PlanAttention> {
      const rec = await loadPlan(ctx, input.planId);
      if (!d.radar) return { planId: rec.plan.planId, monitoring: { state: 'NOT_CONFIGURED', reasons: ['NO_QUERY'], lastObservedAt: null }, coverage: null,
        needsReview: false, items: [], truncated: false, clearedAt: null, note: 'Decision Radar is not configured on this installation. Run "Re-check evidence" before approving or executing.' };
      return d.radar.attention(rec.plan.planId);
    },

    async getCapabilities(): Promise<CapabilityAvailability> {
      return {
        // Shipped modules: the validator is available for a Jira admin to add to a workflow; the Rovo agent is available on
        // sites with Rovo (verified in Rovo chat on the dev site); MCP tools additionally need an org admin to enable
        // "Expose tools to MCP-compatible apps", which the app cannot detect, hence PERMISSION_REQUIRED.
        jiraRead: 'AVAILABLE', jiraWrite: 'AVAILABLE', confluenceRead: 'NOT_CONFIGURED', workflowValidator: 'AVAILABLE',
        rovoAgent: 'AVAILABLE', rovoMcp: 'PERMISSION_REQUIRED', teamworkGraph: 'NOT_CONFIGURED', llm: 'DISABLED_BY_BUDGET',
        operations: OPERATION_NAMES,
        portfolioSimulation: 'AVAILABLE'
      };
    },

    async getPolicies() { return DEFAULT_POLICIES; },

    async listProjects(_ctx: Ctx, input: { cursor: string | null }): Promise<{ items: ProjectSummary[]; page: { nextCursor: string | null; totalKnown: number | null } }> {
      const startAt = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
      const r = await d.jira.searchProjects(startAt, 50);
      const site = d.jira.siteUrl();
      return {
        items: r.items.map((p) => ({ id: p.id, key: p.key, name: p.name, issueCount: p.issueCount, lastSnapshotAt: null,
          url: site ? `${site.replace(/\/$/, '')}/browse/${p.key}` : null, dataAvailability: p.issueCount === 0 ? 'EMPTY' : 'NO_SNAPSHOT' })),
        page: { nextCursor: r.isLast ? null : String(startAt + r.items.length), totalKnown: null }
      };
    },

    async getChangeCandidates(_ctx: Ctx, input: { projectId: string; cursor: string | null }) {
      if (!/^[0-9]+$|^[A-Z][A-Z0-9_]+$/.test(input.projectId)) fail('VALIDATION', 'projectId must be a Jira project id or key.');
      const jql = `project = ${input.projectId} AND labels = "${CHANGE_LABEL}" ORDER BY updated DESC`;
      const r = await d.jira.searchIssues(jql, input.cursor, 50);
      return { items: r.items.map(toSummary), page: { nextCursor: r.nextPageToken, totalKnown: null } };
    },

    async getGraphSnapshot(ctx: Ctx, input: { projectId: string; rootIssueKey: string; source: 'JIRA' | 'DEMO_FIXTURE'; maxDepth: number }): Promise<GraphSnapshot> {
      if (input.source === 'DEMO_FIXTURE') return FIXTURE_SNAPSHOT;
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      if (!/^[A-Z][A-Z0-9_]+-[0-9]+$/.test(input.rootIssueKey)) fail('VALIDATION', 'rootIssueKey must look like ABC-123.');
      const root = await d.jira.getIssue(input.rootIssueKey);
      if (root.kind === 'forbidden') fail('PERMISSION_DENIED', `You cannot browse ${input.rootIssueKey}.`);
      if (root.kind === 'not_found') fail('NOT_FOUND', `${input.rootIssueKey} does not exist or is not visible to you.`);
      const snapshotId = `snap-${d.newId()}`;
      const jiraOnly = await extractGraph(d.jira, input.rootIssueKey, { maxDepth: input.maxDepth, maxNodes: 200, snapshotId, projectId: input.projectId, now: d.now(), ttlHours: SNAPSHOT_TTL_HOURS });
      const source = d.context ?? notConfiguredTwg;
      const keys = jiraOnly.nodes.filter((n) => n.id.startsWith('issue:') && n.status !== 'UNKNOWN').map((n) => n.id.slice(6));
      const extra = await source.fetch(keys).catch((e) => ({ state: 'UNAVAILABLE' as const, detail: `Teamwork Graph error: ${e instanceof Error ? e.message.slice(0, 200) : 'unknown'}`, objects: [], relations: [] }));
      const snapshot = mergeSource(jiraOnly, extra);
      const projectKey = root.kind === 'ok' ? root.issue.projectKey : input.projectId;
      await d.store.set<SnapRec>(K.snap(snapshotId), { snapshot, owner: ctx.accountId, rootIssueKey: input.rootIssueKey, projectKey });
      return snapshot;
    },

    async getEvidenceGraph(ctx: Ctx, input: { snapshotId: string }) {
      const s = await loadSnap(ctx, input.snapshotId);
      if (isExpired(s.snapshot)) fail('SNAPSHOT_EXPIRED', 'Snapshot expired; rebuild it from Jira.');
      return s.snapshot;
    },

    /**
     * Read-only Portfolio Impact Simulator on a real, permission-filtered Jira snapshot (issue #134).
     * Builds the snapshot exactly like getGraphSnapshot (as the calling user; stored like any snapshot), or reuses one the caller owns.
     * Every referenced node must be a node of that snapshot that the user can read: nothing is invented, and unreadable
     * (forbidden / missing) issues are rejected with the same message as absent ones so their existence is not confirmed.
     */
    async simulatePortfolio(ctx: Ctx, input: SimulatePortfolioRequest): Promise<SimulatePortfolioResult> {
      if (!ctx.accountId && input.source !== 'DEMO_FIXTURE') fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      if (input.changes.length > PORTFOLIO_LIMITS.maxChanges) fail('VALIDATION', `At most ${PORTFOLIO_LIMITS.maxChanges} changes are allowed.`);
      let snapshot: GraphSnapshot; let rootIssueKey: string; let reused = false;
      if (input.snapshotId) {
        const s = await loadSnap(ctx, input.snapshotId);
        if (isExpired(s.snapshot)) fail('SNAPSHOT_EXPIRED', 'Snapshot expired; rebuild it from Jira.');
        if (s.rootIssueKey !== input.rootIssueKey) fail('VALIDATION', `Snapshot ${input.snapshotId} was not built for ${input.rootIssueKey}.`);
        snapshot = s.snapshot; rootIssueKey = s.rootIssueKey; reused = true;
      } else {
        snapshot = await this.getGraphSnapshot(ctx, { projectId: input.projectId, rootIssueKey: input.rootIssueKey, source: input.source, maxDepth: input.snapshotMaxDepth });
        rootIssueKey = input.source === 'DEMO_FIXTURE' ? 'PAY-412' : input.rootIssueKey;
      }
      const readable = new Set(snapshot.nodes.filter((n) => !(n.status === 'UNKNOWN' && (n.attributes['access'] === 'forbidden' || n.attributes['access'] === 'not_found'))).map((n) => n.id));
      const opNodes = (op: ChangeOperation) => (op.op === 'MIGRATE_DEPENDENTS' ? [op.fromNodeId, op.toNodeId] : [op.nodeId]);
      const missing = [...new Set(input.changes.flatMap((c) => c.operations.flatMap(opNodes)).filter((id) => !readable.has(id)))].sort();
      if (missing.length) {
        fail('VALIDATION', `Not in your evidence snapshot of ${rootIssueKey} (or not visible to you): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` (+${missing.length - 10} more)` : ''}.`,
          { unknownNodeIds: missing.slice(0, 50), snapshotId: snapshot.snapshotId });
      }
      let result;
      try {
        result = runPortfolio(snapshot, input.changes, { maxDepth: input.maxDepth, rules: DEFAULT_POLICIES, proposedOrder: input.proposedOrder });
      } catch (e) {
        if (e instanceof PortfolioError) fail(e.code, e.issues.slice(0, 5).join('; ').slice(0, 900), { issues: e.issues.slice(0, 20) });
        throw e;
      }
      return { ...result, snapshot: { snapshotId: snapshot.snapshotId, projectId: snapshot.projectId, rootIssueKey, mode: snapshot.mode, createdAt: snapshot.createdAt,
        expiresAt: snapshot.expiresAt, truncated: snapshot.truncated, nodeCount: snapshot.nodes.length, edgeCount: snapshot.edges.length, reused,
        ...(snapshot.coverage ? { coverage: snapshot.coverage } : {}) } };
    },

    /**
     * Release Safety Control Plane (read-only, no Jira or storage writes): change issues of a project/release as the
     * calling user, joined with the caller's own latest decision per issue. See src/engine/release.ts for the rules.
     */
    async getReleaseSafety(ctx: Ctx, input: { projectKey: string; fixVersion: string | null }): Promise<ReleaseSafety> {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Atlassian user is required.');
      if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(input.projectKey)) fail('VALIDATION', 'projectKey must look like ABC.');
      if (input.fixVersion !== null && !/^[^"\\\n\r]{1,255}$/.test(input.fixVersion)) fail('VALIDATION', 'fixVersion contains unsupported characters.');
      const perms = await d.jira.myPermissions(input.projectKey, ['BROWSE_PROJECTS']);
      if (!perms['BROWSE_PROJECTS']) fail('PERMISSION_DENIED', `You cannot browse project ${input.projectKey}.`);
      const jql = `project = ${input.projectKey} AND labels = "${CHANGE_LABEL}"${input.fixVersion ? ` AND fixVersion = "${input.fixVersion}"` : ''} ORDER BY key ASC`;
      const issues: JiraIssue[] = []; let token: string | null = null; let truncated = false;
      do {
        const page = await d.jira.searchIssues(jql, token, RELEASE_SAFETY_LIMITS.pageSize);
        issues.push(...page.items); token = page.nextPageToken;
        if (issues.length >= RELEASE_SAFETY_LIMITS.maxIssues) { truncated = token !== null || issues.length > RELEASE_SAFETY_LIMITS.maxIssues; break; }
      } while (token);
      const bounded = issues.slice(0, RELEASE_SAFETY_LIMITS.maxIssues);
      const decisions: Record<string, DecisionRecord | undefined> = {};
      for (let i = 0; i < bounded.length; i += 10) {
        const chunk = bounded.slice(i, i + 10);
        const recs = await Promise.all(chunk.map((x) => d.store.get<DecisionRecord>(`decision:${x.key}`)));
        // Plans are private: only the caller's own decision is used; anyone else's counts as "none visible".
        chunk.forEach((x, j) => { const r = recs[j]; decisions[x.key] = r && r.owner === ctx.accountId ? r : undefined; });
      }
      return aggregateRelease({ projectKey: input.projectKey, fixVersion: input.fixVersion, jql, evaluatedAt: iso(), issues: bounded, truncated,
        siteUrl: d.jira.siteUrl(), decisions });
    },

    async simulateChange(ctx: Ctx, req: SimulationRequest) {
      const s = await loadSnap(ctx, req.snapshotId);
      if (isExpired(s.snapshot)) fail('SNAPSHOT_EXPIRED', 'Snapshot expired; rebuild it from Jira.');
      return req.scenarios.map((sc) => wrapValidation(() => simulate(s.snapshot, sc, DEFAULT_POLICIES, req.maxDepth)));
    },

    async compareScenarios(ctx: Ctx, req: SimulationRequest): Promise<ScenarioComparison> {
      const s = await loadSnap(ctx, req.snapshotId);
      if (isExpired(s.snapshot)) fail('SNAPSHOT_EXPIRED', 'Snapshot expired; rebuild it from Jira.');
      const comparison = wrapValidation(() => compare(s.snapshot, req.scenarios, DEFAULT_POLICIES, req.maxDepth));
      await d.store.set<CmpRec>(K.cmp(`${ctx.accountId}:${req.snapshotId}`), { request: req, comparison });
      return comparison;
    },

    async generatePreventionPlan(ctx: Ctx, input: { snapshotId: string; scenarioId: string }): Promise<PreventionPlan> {
      const s = await loadSnap(ctx, input.snapshotId);
      const c = await d.store.get<CmpRec>(K.cmp(`${ctx.accountId}:${input.snapshotId}`));
      if (!c) fail('NOT_FOUND', 'Run compareScenarios on this snapshot first.');
      const result = c!.comparison.results.find((r) => r.scenarioId === input.scenarioId);
      if (!result) fail('NOT_FOUND', `Scenario ${input.scenarioId} was not part of the comparison.`);
      const planId = `plan-${d.newId()}`;
      const plan = buildPlan({ planId, snapshot: s.snapshot, result: result!, rootIssueKey: s.rootIssueKey, projectKey: s.projectKey, createdAt: iso() });
      await d.store.set<PlanRec>(K.plan(planId), { plan, owner: ctx.accountId, rootIssueKey: s.rootIssueKey, projectKey: s.projectKey, approvedActionIds: [], approvals: [],
        timeline: [{ at: s.snapshot.createdAt, event: `Snapshot ${s.snapshot.snapshotId} captured` }, { at: iso(), event: `Plan generated for scenario ${input.scenarioId}` }] });
      await d.store.set(K.cmp(`plan:${planId}`), c);
      const causal = s.snapshot.edges.filter((e) => ['DEPENDS_ON', 'USES', 'BLOCKS', 'AFFECTS', 'VERIFIED_BY'].includes(e.kind));
      await d.store.set<ProvRec>(K.prov(planId), { owner: ctx.accountId, snapshotId: s.snapshot.snapshotId, mode: s.snapshot.mode,
        capturedAt: s.snapshot.createdAt, expiresAt: s.snapshot.expiresAt, nodeCount: s.snapshot.nodes.length, edgeCount: s.snapshot.edges.length,
        causalEdges: causal.slice(0, 300).map((e) => ({ from: e.from, to: e.to, kind: e.kind, status: e.status })), snapshotDigest: stableHash(s.snapshot) });
      // Decision Radar: index the Jira issue ids of the evidence (best effort; failures surface as DEGRADED coverage).
      if (d.radar) { try { await d.radar.indexPlan(planId, s.snapshot.nodes); } catch { /* coverage record shows NOT_INDEXED */ } }
      return plan;
    },

    async approvePlan(ctx: Ctx, req: ApprovalRequest): Promise<PreventionPlan> {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'Approval requires an authenticated Atlassian user.');
      if (!req.approvedActionIds.length) fail('VALIDATION', 'Select at least one action to approve.');
      const fingerprint = `${req.planId}|${stableHash([...new Set(req.approvedActionIds)].sort())}`;
      const prior = await d.store.get<string>(K.idem(`approve:${req.idempotencyKey}`));
      if (prior) { if (prior !== fingerprint && prior !== req.planId) fail('CONFLICT', 'Idempotency key reused with a different approval.'); return (await loadPlan(ctx, req.planId)).plan; }
      const rec = await loadPlan(ctx, req.planId);
      if (rec.plan.planHash !== req.planHash) fail('STALE_APPROVAL', 'The plan changed since you reviewed it. Review it again.');
      if (!['PENDING_APPROVAL', 'APPROVED', 'PARTIAL', 'FAILED'].includes(rec.plan.status)) fail('CONFLICT', `Plan is ${rec.plan.status}.`);
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      if (isExpired(snap.snapshot)) { await this.markExpired(rec); fail('SNAPSHOT_EXPIRED', 'Snapshot expired; regenerate the plan.'); }
      await guardFreshEvidence(rec, snap, 'approval');
      const known = new Set(rec.plan.actions.map((a) => a.actionId));
      const bad = req.approvedActionIds.filter((id) => !known.has(id));
      if (bad.length) fail('VALIDATION', `Unknown actions: ${bad.join(', ')}`);
      if (!(await d.store.setIfAbsent(K.idem(`approve:${req.idempotencyKey}`), fingerprint))) {
        if ((await d.store.get<string>(K.idem(`approve:${req.idempotencyKey}`))) !== fingerprint) fail('CONFLICT', 'Idempotency key reused with a different approval.');
        return (await loadPlan(ctx, req.planId)).plan;
      }
      rec.approvedActionIds = [...new Set([...rec.approvedActionIds, ...req.approvedActionIds])];
      rec.approvals.push({ accountId: ctx.accountId, at: iso(), actionIds: req.approvedActionIds, planHash: req.planHash });
      rec.plan = { ...rec.plan, status: 'APPROVED' };
      rec.timeline.push({ at: iso(), event: `${req.approvedActionIds.length} action(s) approved` });
      await d.store.set(K.plan(req.planId), rec);
      return rec.plan;
    },

    async markExpired(rec: PlanRec) {
      rec.plan = { ...rec.plan, status: 'EXPIRED' };
      rec.timeline.push({ at: iso(), event: 'Plan expired with its snapshot' });
      await d.store.set(K.plan(rec.plan.planId), rec);
    },

    async executeApprovedPlan(ctx: Ctx, input: { planId: string; idempotencyKey: string }): Promise<ExecutionRecord[]> {
      const rec = await loadPlan(ctx, input.planId);
      if (rec.plan.snapshotId === FIXTURE_SNAPSHOT.snapshotId) fail('UNSUPPORTED', 'Demo-fixture plans can never write to Jira.');
      if (rec.plan.status === 'INVALIDATED') fail('CONFLICT', 'This plan was invalidated because the evidence changed after approval. Re-run the comparison and review a new plan.');
      if (!['APPROVED', 'PARTIAL', 'FAILED'].includes(rec.plan.status)) fail('CONFLICT', `Plan is ${rec.plan.status}; approve it first.`);
      const latest = rec.approvals[rec.approvals.length - 1];
      if (!latest || latest.planHash !== rec.plan.planHash) fail('STALE_APPROVAL', 'No valid approval for the current plan.');
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      if (isExpired(snap.snapshot)) { await this.markExpired(rec); fail('SNAPSHOT_EXPIRED', 'Snapshot expired; regenerate the plan.'); }
      // Continuous Decision Safety: never write on evidence that changed after approval.
      await guardFreshEvidence(rec, snap, 'execution');
      // Shared decisions: the link is server-side state written at share time, so a client cannot bypass review by omitting an id.
      // Fail closed: a governed plan without a verifiable gate never writes.
      const link = await d.store.get<{ decisionId?: string }>(`ws:plan:${input.planId}`);
      const governedBy = link ? (typeof link.decisionId === 'string' ? link.decisionId : fail('CONFLICT', 'This plan is linked to an unreadable shared decision; regenerate the plan.')) : null;
      if (governedBy) {
        if (!d.sharedDecisions) fail('UNSUPPORTED', 'This plan is governed by a shared decision that cannot be verified here.', { decisionId: governedBy });
        await d.sharedDecisions!.authorizeExecution(ctx, governedBy, rec.plan.planHash);
      }

      // Lease: one executor per plan at a time.
      const lockKey = K.lock(input.planId);
      const lease = { until: d.now().getTime() + LEASE_MS, key: input.idempotencyKey, token: d.newId() };
      if (!(await d.store.setIfAbsent(lockKey, lease))) {
        const cur = await d.store.get<typeof lease>(lockKey);
        if (cur && cur.until > d.now().getTime()) fail('CONFLICT', 'This plan is already executing.');
        // Expired lease takeover is itself a race: only ONE contender may claim a given expired lease.
        // The claim key is unique to that lease (its token/expiry), and setIfAbsent is atomic (KVS FAIL_IF_EXISTS).
        const claim = `lock-takeover:${input.planId}:${cur?.token ?? cur?.until ?? 'missing'}`;
        if (!(await d.store.setIfAbsent(claim, { by: lease.token, at: iso() }))) fail('CONFLICT', 'Another executor is taking over this plan.');
        await d.store.set(lockKey, lease);
      }
      try {
        rec.plan = { ...rec.plan, status: 'EXECUTING' };
        await d.store.set(K.plan(input.planId), rec);
        const perms = await d.jira.myPermissions(rec.projectKey, ['CREATE_ISSUES', 'LINK_ISSUES', 'ADD_COMMENTS', 'EDIT_ISSUES', 'BROWSE_PROJECTS']);
        const out: ExecutionRecord[] = [];
        let stopped = false;
        for (const action of rec.plan.actions.filter((a) => rec.approvedActionIds.includes(a.actionId))) {
          // Re-check right before every Jira write: a revocation, rejection or expiry landing mid-run stops further writes.
          if (governedBy && !(await d.sharedDecisions!.stillApproved(governedBy, rec.plan.planHash))) {
            rec.timeline.push({ at: iso(), event: `Execution stopped: shared decision ${governedBy} is no longer approved` });
            stopped = true; break;
          }
          out.push(await executeOne(rec, action, perms, input.idempotencyKey));
        }
        const verified = out.filter((r) => r.status === 'VERIFIED').length;
        // COMPLETED means EVERY action of the plan was approved and verified. Verifying a subset (e.g. only the
        // decision comment) is PARTIAL and can never produce an attestation that opens the workflow gate.
        const allApproved = rec.plan.actions.every((a) => rec.approvedActionIds.includes(a.actionId));
        rec.plan = { ...rec.plan, status: stopped ? (verified === 0 ? 'FAILED' : 'PARTIAL')
          : verified === out.length && out.length > 0 ? (allApproved ? 'COMPLETED' : 'PARTIAL') : verified === 0 ? 'FAILED' : 'PARTIAL' };
        rec.timeline.push({ at: iso(), event: `Execution finished: ${verified}/${out.length} verified` });
        await d.store.set(K.plan(input.planId), rec);
        await recordDecision(rec);
        return out;
      } finally {
        const held = await d.store.get<typeof lease>(lockKey);
        if (held?.token === lease.token) await d.store.delete(lockKey); // never release someone else's lease
      }
    },

    async getExecutionStatus(ctx: Ctx, input: { planId: string }): Promise<ExecutionRecord[]> {
      const rec = await loadPlan(ctx, input.planId);
      const all = await Promise.all(rec.plan.actions.map((a) => d.store.get<ExecutionRecord>(K.exec(input.planId, a.actionId))));
      return all.filter((x): x is ExecutionRecord => !!x);
    },

    async getPreventionPassport(ctx: Ctx, input: { planId: string }): Promise<PreventionPassport> {
      const rec = await loadPlan(ctx, input.planId);
      const ev = await loadEvidence(ctx, rec);
      const cmp = await d.store.get<CmpRec>(K.cmp(`plan:${input.planId}`));
      if (!cmp) fail('NOT_FOUND', 'Comparison for this plan is missing.');
      const executions = await this.getExecutionStatus(ctx, input);
      // Same decision the Jira workflow validator would take now (as the reading user; no write), scoped to this plan's attestation.
      let gate: { status: 'OPEN' | 'CLOSED' | 'NOT_GATED'; reason: string } | undefined;
      try {
        const live = await d.jira.getIssue(rec.rootIssueKey);
        const scoped = rec.owner ? await d.store.get<DecisionRecord>(decisionKey(rec.owner, rec.rootIssueKey, rec.plan.planId)) : undefined;
        const decision = scoped ?? await d.store.get<DecisionRecord>(`decision:${rec.rootIssueKey}`);
        if (live.kind === 'ok' && !live.issue.labels.includes(CHANGE_LABEL)) gate = { status: 'NOT_GATED', reason: `${rec.rootIssueKey} is not labelled ${CHANGE_LABEL}; the workflow validator does not gate it.` };
        else if (live.kind === 'ok') {
          const dec = decideTransition(live.issue, decision, rec.rootIssueKey, d.now(), { owner: rec.owner, planId: rec.plan.planId });
          gate = dec.result ? { status: 'OPEN', reason: 'A valid decision attestation allows the Jira transition.' } : { status: 'CLOSED', reason: (dec.errorMessage ?? '').replace(/^ANTICIPATE Decision Firewall: /, '').slice(0, 500) };
        }
      } catch { gate = undefined; }
      const chosen = cmp!.comparison.results.find((r) => r.scenarioId === rec.plan.scenarioId);
      return {
        passportId: `passport-${input.planId}`, mode: ev.mode, snapshotId: rec.plan.snapshotId,
        gate,
        evidence: ev.prov ? { state: ev.state, capturedAt: ev.prov.capturedAt, expiresAt: ev.prov.expiresAt, nodeCount: ev.prov.nodeCount,
          edgeCount: ev.prov.edgeCount, causalEdgeCount: ev.prov.causalEdges.length, snapshotDigest: ev.prov.snapshotDigest } : undefined,
        change: cmp!.request.change, comparison: cmp!.comparison, plan: rec.plan,
        approvals: rec.approvals.map((a) => ({ accountId: a.accountId, at: a.at, actionIds: a.actionIds })),
        executions, openUnknowns: chosen?.uncertainties ?? [], timeline: [...rec.timeline].sort((a, b) => a.at.localeCompare(b.at)),
        disclaimer: ev.mode === 'DEMO_FIXTURE'
          ? 'DEMO FIXTURE — fictional data; no Jira data was read or written.'
          : `${ev.state === 'LIVE' ? '' : 'HISTORICAL RECORD — evidence as reviewed when the plan was created, not current live evidence. '}Generated by ANTICIPATE from a Jira snapshot readable by the requesting user. Not a legal, compliance or cryptographic attestation.`
      };
    }
  };

  async function executeOne(rec: PlanRec, a: ProposedAction, perms: Record<string, boolean>, idem: string): Promise<ExecutionRecord> {
    const key = K.exec(rec.plan.planId, a.actionId);
    const prev = await d.store.get<ExecutionRecord>(key);
    if (prev?.status === 'VERIFIED') return prev;
    const attempt = (prev?.attempt ?? 0) + 1;
    const base = { executionId: prev?.executionId ?? `exec-${d.newId()}`, planId: rec.plan.planId, actionId: a.actionId, attempt, idempotencyKey: prev?.idempotencyKey ?? idem };
    const save = async (r: ExecutionRecord) => { await d.store.set(key, r); return r; };
    if (attempt > MAX_ATTEMPTS) return save({ ...base, status: 'FAILED', resultRef: prev?.resultRef ?? null, updatedAt: iso(), error: { code: 'CONFLICT', message: 'Maximum attempts reached.', requestId: idem, retryable: false } });
    const missing = a.requiredPermission.split(',').filter((p) => !perms[p]);
    if (missing.length) return save({ ...base, status: 'FAILED', resultRef: null, updatedAt: iso(), error: { code: 'PERMISSION_DENIED', message: `Missing Jira permission: ${missing.join(', ')}`, requestId: idem, retryable: false } });
    await save({ ...base, status: 'CLAIMED', resultRef: prev?.resultRef ?? null, error: null, updatedAt: iso() });
    const marker = actionMarker(rec.plan.planId, a.actionId);
    try {
      let issueKey: string | null = null;
      if (a.type === 'CREATE_ISSUE') {
        const p = a.payload as { summary: string; description: string; blocksIssueKey: string; linkType: string };
        const found = await d.jira.searchIssues(`project = ${a.targetProjectKey} AND labels = "${marker}"`, null, 2);
        issueKey = found.items[0]?.key ?? null;
        if (!issueKey) {
          const types = await d.jira.issueTypes(a.targetProjectKey);
          const t = types.find((x) => x === 'Task') ?? types.find((x) => !/epic|sub/i.test(x)) ?? types[0];
          if (!t) throw new AppError('UNSUPPORTED', 'No usable issue type in target project.');
          issueKey = (await d.jira.createIssue({ projectKey: a.targetProjectKey, summary: p.summary, description: p.description, issueType: t, labels: ['anticipate', marker] })).key;
        }
        const cur = await d.jira.getIssue(issueKey);
        const linked = cur.kind === 'ok' && cur.issue.links.some((l) => l.otherKey === p.blocksIssueKey && l.typeName === p.linkType);
        if (!linked) await d.jira.createLink({ typeName: p.linkType, outwardKey: issueKey, inwardKey: p.blocksIssueKey });
        await save({ ...base, status: 'SUBMITTED', resultRef: ref(issueKey), error: null, updatedAt: iso() });
        const v = await d.jira.getIssue(issueKey);
        const ok = v.kind === 'ok' && v.issue.labels.includes(marker) && v.issue.links.some((l) => l.otherKey === p.blocksIssueKey);
        if (!ok) throw new AppError('UPSTREAM_UNAVAILABLE', 'Write submitted but verification did not observe the expected issue + link.', true);
      } else if (a.type === 'ADD_LABEL') {
        issueKey = a.targetIssueKey!;
        const label = (a.payload as { label: string }).label;
        const cur = await d.jira.getIssue(issueKey);
        if (!(cur.kind === 'ok' && cur.issue.labels.includes(label))) await d.jira.addLabel(issueKey, label);
        await save({ ...base, status: 'SUBMITTED', resultRef: ref(issueKey), error: null, updatedAt: iso() });
        const v = await d.jira.getIssue(issueKey);
        if (!(v.kind === 'ok' && v.issue.labels.includes(label))) throw new AppError('UPSTREAM_UNAVAILABLE', 'Label not observed after write.', true);
      } else if (a.type === 'ADD_COMMENT') {
        issueKey = a.targetIssueKey!;
        const tag = `[${marker}]`;
        if (!(await d.jira.getCommentsText(issueKey)).some((t) => t.includes(tag))) await d.jira.addComment(issueKey, `${(a.payload as { text: string }).text}\n${tag}`);
        await save({ ...base, status: 'SUBMITTED', resultRef: ref(issueKey), error: null, updatedAt: iso() });
        if (!(await d.jira.getCommentsText(issueKey)).some((t) => t.includes(tag))) throw new AppError('UPSTREAM_UNAVAILABLE', 'Comment not observed after write.', true);
      } else {
        if (a.type === 'ADD_ISSUE_LINK') {
          const p = a.payload as { type: unknown; inward: unknown; outward: unknown };
          if (typeof p.type !== 'string' || !p.type || typeof p.inward !== 'string' || !p.inward || typeof p.outward !== 'string' || !p.outward)
            throw new AppError('VALIDATION', 'ADD_ISSUE_LINK payload requires { type, inward, outward } issue keys.');
          const typeName = p.type; const inwardKey = p.inward; const outwardKey = p.outward;
          issueKey = a.targetIssueKey ?? outwardKey;
          const cur = await d.jira.getIssue(outwardKey);
          const linked = cur.kind === 'ok' && cur.issue.links.some((l) => l.otherKey === inwardKey && l.typeName === typeName);
          if (!linked) await d.jira.createLink({ typeName, outwardKey, inwardKey });
          await save({ ...base, status: 'SUBMITTED', resultRef: ref(issueKey), error: null, updatedAt: iso() });
          const v = await d.jira.getIssue(outwardKey);
          if (!(v.kind === 'ok' && v.issue.links.some((l) => l.otherKey === inwardKey && l.typeName === typeName))) throw new AppError('UPSTREAM_UNAVAILABLE', 'Link not observed after write.', true);
        } else {
          throw new AppError('UNSUPPORTED', `Action type ${a.type} not implemented.`);
        }
      }
      return save({ ...base, status: 'VERIFIED', resultRef: ref(issueKey), error: null, updatedAt: iso() });
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError('UPSTREAM_UNAVAILABLE', e instanceof Error ? e.message.slice(0, 500) : 'Jira error', true);
      return save({ ...base, status: 'FAILED', resultRef: null, updatedAt: iso(), error: { code: err.code, message: err.message, requestId: idem, retryable: err.retryable } });
    }
  }

  function ref(k: string | null) {
    const site = d.jira.siteUrl();
    return { issueKey: k, url: k && site ? `${site.replace(/\/$/, '')}/browse/${k}` : null };
  }
}

function wrapValidation<T>(fn: () => T): T {
  try { return fn(); } catch (e) {
    if (e instanceof Error && e.message.startsWith('VALIDATION')) throw new AppError('VALIDATION', e.message);
    throw e;
  }
}

/** Jira returns "2026-11-02T10:00:00.000+0100"; contracts require RFC3339 offsets. */
export function normalizeDate(s: string): string {
  const fixed = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  return Number.isNaN(Date.parse(fixed)) ? new Date(0).toISOString() : fixed;
}

export const OPERATION_NAMES = ['getCapabilities', 'getPolicies', 'listProjects', 'getChangeCandidates', 'getGraphSnapshot', 'getEvidenceGraph', 'simulateChange',
  'compareScenarios', 'generatePreventionPlan', 'approvePlan', 'executeApprovedPlan', 'getExecutionStatus', 'getPreventionPassport', 'checkPlanFreshness', 'previewSampleProject', 'createSampleProject', 'getValidatorPolicy', 'setValidatorPolicy', 'simulateSlip', 'simulatePortfolio', 'getPlanAttention', 'getReleaseSafety',
  // capability signals (not resolvers): scenario operations accepted by compareScenarios / generatePreventionPlan
  'scenario:UPGRADE_NODE', 'validator:outage-policy'];
export { issueNodeId };
