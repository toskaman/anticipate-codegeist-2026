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
import type { EvidenceDrift } from '../../packages/contracts/src/index';

export const CHANGE_LABEL = 'anticipate-change';
const SNAPSHOT_TTL_HOURS = 24;
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 5;

interface SnapRec { snapshot: GraphSnapshot; owner: string | null; rootIssueKey: string; projectKey: string; }
interface CmpRec { request: SimulationRequest; comparison: ScenarioComparison; }
interface PlanRec { plan: PreventionPlan; owner: string | null; rootIssueKey: string; projectKey: string; approvedActionIds: string[];
  approvals: { accountId: string | null; at: string; actionIds: string[]; planHash: string }[]; timeline: { at: string; event: string }[]; }

const K = {
  snap: (id: string) => `snap:${id}`, cmp: (id: string) => `cmp:${id}`, plan: (id: string) => `plan:${id}`,
  exec: (p: string, a: string) => `exec:${p}:${a}`, lock: (p: string) => `lock:${p}`, idem: (k: string) => `idem:${k}`
};

export function createService(d: Deps) {
  const iso = () => d.now().toISOString();

  async function loadSnap(ctx: Ctx, snapshotId: string): Promise<SnapRec> {
    if (snapshotId === FIXTURE_SNAPSHOT.snapshotId) return { snapshot: FIXTURE_SNAPSHOT, owner: null, rootIssueKey: 'PAY-412', projectKey: 'DEMO' };
    const r = await d.store.get<SnapRec>(K.snap(snapshotId));
    if (!r) fail('NOT_FOUND', `Snapshot ${snapshotId} not found.`);
    if (r!.owner !== ctx.accountId) fail('PERMISSION_DENIED', 'Snapshots are private to the user who created them.');
    return r!;
  }
  const isExpired = (s: GraphSnapshot) => s.mode === 'LIVE' && new Date(s.expiresAt).getTime() < d.now().getTime();

  async function loadPlan(ctx: Ctx, planId: string): Promise<PlanRec> {
    const r = await d.store.get<PlanRec>(K.plan(planId));
    if (!r) fail('NOT_FOUND', `Plan ${planId} not found.`);
    if (r!.owner !== ctx.accountId) fail('PERMISSION_DENIED', 'Plans are private to the user who created them.');
    return r!;
  }

  const toSummary = (i: JiraIssue): JiraIssueSummary => ({
    id: i.id, key: i.key, summary: i.summary.slice(0, 1000), status: i.status, issueType: i.issueType, projectId: i.projectId, updatedAt: normalizeDate(i.updated),
    url: d.jira.siteUrl() ? `${d.jira.siteUrl()!.replace(/\/$/, '')}/browse/${i.key}` : null
  });

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
    throw new AppError('EVIDENCE_CHANGED', drift.reason, false, { addedEdges: drift.addedEdges, removedEdges: drift.removedEdges, becameUnknown: drift.becameUnknown });
  }

  return {
    async previewSampleProject(_ctx: Ctx, input: { projectKey: string }) { return previewSample(d.jira, input.projectKey); },

    async createSampleProject(ctx: Ctx, input: { projectKey: string; confirm: true }) {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'Creating sample data requires an authenticated Atlassian user.');
      return createSample(d.jira, input.projectKey);
    },

    async checkPlanFreshness(ctx: Ctx, input: { planId: string }): Promise<EvidenceDrift> {
      const rec = await loadPlan(ctx, input.planId);
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      return evidenceDrift(rec, snap);
    },

    async getCapabilities(): Promise<CapabilityAvailability> {
      return {
        jiraRead: 'AVAILABLE', jiraWrite: 'AVAILABLE', confluenceRead: 'NOT_CONFIGURED', workflowValidator: 'NOT_CONFIGURED',
        rovoAgent: 'NOT_CONFIGURED', rovoMcp: 'NOT_CONFIGURED', teamworkGraph: 'NOT_CONFIGURED', llm: 'DISABLED_BY_BUDGET',
        operations: OPERATION_NAMES
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
      if (!/^[A-Z][A-Z0-9_]+-[0-9]+$/.test(input.rootIssueKey)) fail('VALIDATION', 'rootIssueKey must look like ABC-123.');
      const root = await d.jira.getIssue(input.rootIssueKey);
      if (root.kind === 'forbidden') fail('PERMISSION_DENIED', `You cannot browse ${input.rootIssueKey}.`);
      if (root.kind === 'not_found') fail('NOT_FOUND', `${input.rootIssueKey} does not exist or is not visible to you.`);
      const snapshotId = `snap-${d.newId()}`;
      const snapshot = await extractGraph(d.jira, input.rootIssueKey, { maxDepth: input.maxDepth, maxNodes: 200, snapshotId, projectId: input.projectId, now: d.now(), ttlHours: SNAPSHOT_TTL_HOURS });
      const projectKey = root.kind === 'ok' ? root.issue.projectKey : input.projectId;
      await d.store.set<SnapRec>(K.snap(snapshotId), { snapshot, owner: ctx.accountId, rootIssueKey: input.rootIssueKey, projectKey });
      return snapshot;
    },

    async getEvidenceGraph(ctx: Ctx, input: { snapshotId: string }) {
      const s = await loadSnap(ctx, input.snapshotId);
      if (isExpired(s.snapshot)) fail('SNAPSHOT_EXPIRED', 'Snapshot expired; rebuild it from Jira.');
      return s.snapshot;
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
      return plan;
    },

    async approvePlan(ctx: Ctx, req: ApprovalRequest): Promise<PreventionPlan> {
      if (!ctx.accountId) fail('PERMISSION_DENIED', 'Approval requires an authenticated Atlassian user.');
      const prior = await d.store.get<string>(K.idem(`approve:${req.idempotencyKey}`));
      if (prior) { if (prior !== req.planId) fail('CONFLICT', 'Idempotency key reused for another plan.'); return (await loadPlan(ctx, req.planId)).plan; }
      const rec = await loadPlan(ctx, req.planId);
      if (rec.plan.planHash !== req.planHash) fail('STALE_APPROVAL', 'The plan changed since you reviewed it. Review it again.');
      if (!['PENDING_APPROVAL', 'APPROVED', 'PARTIAL', 'FAILED'].includes(rec.plan.status)) fail('CONFLICT', `Plan is ${rec.plan.status}.`);
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      if (isExpired(snap.snapshot)) { await this.markExpired(rec); fail('SNAPSHOT_EXPIRED', 'Snapshot expired; regenerate the plan.'); }
      await guardFreshEvidence(rec, snap, 'approval');
      const known = new Set(rec.plan.actions.map((a) => a.actionId));
      const bad = req.approvedActionIds.filter((id) => !known.has(id));
      if (bad.length) fail('VALIDATION', `Unknown actions: ${bad.join(', ')}`);
      if (!(await d.store.setIfAbsent(K.idem(`approve:${req.idempotencyKey}`), req.planId))) return (await loadPlan(ctx, req.planId)).plan;
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
      if (!['APPROVED', 'PARTIAL', 'FAILED'].includes(rec.plan.status)) fail('CONFLICT', `Plan is ${rec.plan.status}; approve it first.`);
      const latest = rec.approvals[rec.approvals.length - 1];
      if (!latest || latest.planHash !== rec.plan.planHash) fail('STALE_APPROVAL', 'No valid approval for the current plan.');
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      if (isExpired(snap.snapshot)) { await this.markExpired(rec); fail('SNAPSHOT_EXPIRED', 'Snapshot expired; regenerate the plan.'); }
      // Continuous Decision Safety: never write on evidence that changed after approval.
      await guardFreshEvidence(rec, snap, 'execution');

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
        for (const action of rec.plan.actions.filter((a) => rec.approvedActionIds.includes(a.actionId))) {
          out.push(await executeOne(rec, action, perms, input.idempotencyKey));
        }
        const verified = out.filter((r) => r.status === 'VERIFIED').length;
        rec.plan = { ...rec.plan, status: verified === out.length ? 'COMPLETED' : verified === 0 ? 'FAILED' : 'PARTIAL' };
        rec.timeline.push({ at: iso(), event: `Execution finished: ${verified}/${out.length} verified` });
        await d.store.set(K.plan(input.planId), rec);
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
      const snap = await loadSnap(ctx, rec.plan.snapshotId);
      const cmp = await d.store.get<CmpRec>(K.cmp(`plan:${input.planId}`));
      if (!cmp) fail('NOT_FOUND', 'Comparison for this plan is missing.');
      const executions = await this.getExecutionStatus(ctx, input);
      const chosen = cmp!.comparison.results.find((r) => r.scenarioId === rec.plan.scenarioId);
      return {
        passportId: `passport-${input.planId}`, mode: snap.snapshot.mode, snapshotId: snap.snapshot.snapshotId,
        change: cmp!.request.change, comparison: cmp!.comparison, plan: rec.plan,
        approvals: rec.approvals.map((a) => ({ accountId: a.accountId, at: a.at, actionIds: a.actionIds })),
        executions, openUnknowns: chosen?.uncertainties ?? [], timeline: [...rec.timeline].sort((a, b) => a.at.localeCompare(b.at)),
        disclaimer: snap.snapshot.mode === 'DEMO_FIXTURE'
          ? 'DEMO FIXTURE — fictional data; no Jira data was read or written.'
          : 'Generated by ANTICIPATE from a Jira snapshot readable by the requesting user. Not a legal, compliance or cryptographic attestation.'
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
        throw new AppError('UNSUPPORTED', `Action type ${a.type} not implemented.`);
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
  'compareScenarios', 'generatePreventionPlan', 'approvePlan', 'executeApprovedPlan', 'getExecutionStatus', 'getPreventionPassport', 'checkPlanFreshness', 'previewSampleProject', 'createSampleProject'];
export { issueNodeId };
