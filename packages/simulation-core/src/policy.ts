/**
 * Policy-as-code (P2, PREVIEW ONLY). A small, versioned, declarative policy set evaluated deterministically against
 * data structures the engine already produces: GraphSnapshot, ScenarioDefinition, SimulationResult, PreventionPlan,
 * ExecutionRecord, EvidenceDrift and SharedDecision. See docs/design-core/POLICY_AS_CODE.md.
 *
 * - Closed vocabulary: a rule is one of a fixed set of discriminated types with typed, bounded parameters. No expressions,
 *   no code, no free text (ids and project keys are restricted to a safe character set).
 * - Incremental: this does NOT replace the built-in Decision Firewall rules (P1–P4, evaluated in ./index.ts) nor the Jira
 *   workflow validator (src/validator.ts). Nothing in the app calls this module yet; no result here gates anything.
 * - UNKNOWN is never PASS: a rule that depends on evidence that is UNKNOWN, missing, or not supplied answers NEEDS_REVIEW
 *   with an explanation. In facts, `undefined` means "not supplied / unknown"; `null` means "known to be absent".
 * - Pure: no I/O, no clock, no randomness, no mutation of inputs; output (including order) is independent of the order
 *   of snapshot nodes/edges.
 */
import { z } from 'zod';
import type {
  EvidenceDrift, EvidenceStatus, ExecutionRecord, GraphSnapshot, PreventionPlan, ScenarioDefinition, SharedDecision, SimulationResult
} from '../../contracts/src/index';
import { stableHash } from './index';

// ---------- schema ----------
export const POLICY_SCHEMA_VERSION = 1 as const;
export const POLICY_LIMITS = { maxRules: 50, maxProjectKeys: 100, maxChangeKinds: 5, maxNodeKinds: 8, maxEvidenceRefs: 100, maxExplanation: 1000 } as const;

/** Mirrors contracts NodeKind (a test asserts equality); kept local so this module composes a single zod instance. */
export const POLICY_NODE_KINDS = ['ISSUE', 'PROJECT', 'COMPONENT', 'SERVICE', 'RELEASE', 'TEST', 'DOCUMENT', 'DECISION'] as const;
/** Kinds of change derived from scenario operations (UPGRADE_NODE is split by its `breaking` flag). */
export const CHANGE_KINDS = ['REMOVE_NODE', 'DEPRECATE_NODE', 'UPGRADE_BREAKING', 'UPGRADE_COMPATIBLE', 'MIGRATE_DEPENDENTS'] as const;
export type ChangeKind = typeof CHANGE_KINDS[number];

/** Safe identifier: letters, digits, '.', '_' and '-' only. Rejects anything that looks like code or markup. */
const SafeId = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,63}$/, 'ids may only contain letters, digits, ".", "_" and "-" (max 64)');
const ProjectKey = z.string().regex(/^[A-Z][A-Z0-9_]{0,19}$/, 'project keys are Jira keys (A-Z, 0-9, _)');
const uniq = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const ChangeKindSchema = z.enum(CHANGE_KINDS);
const NodeKindSchema = z.enum(POLICY_NODE_KINDS);

const rule = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) => z.object({ id: SafeId, type: z.literal(type), ...shape }).strict();

export const PolicyRuleSpec = z.discriminatedUnion('type', [
  /** A breaking change (REMOVE_NODE or breaking UPGRADE_NODE) impacting >= minImpacted items needs a reviewed plan. */
  rule('REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', { minImpacted: z.number().int().min(1).max(5000) }),
  /** Changes of these kinds need >= minApprovers approvals by people other than the proposer, bound to the current plan hash. */
  rule('REQUIRE_INDEPENDENT_APPROVAL', {
    changeKinds: z.array(ChangeKindSchema).min(1).max(POLICY_LIMITS.maxChangeKinds).refine(uniq, 'changeKinds must be unique'),
    minApprovers: z.number().int().min(1).max(3)
  }),
  /** Block when a BLOCKER-severity firewall violation is backed by CONFIRMED evidence. */
  rule('BLOCK_WITH_CONFIRMED_BLOCKERS', {}),
  /** Impacted items of these kinds need a CONFIRMED VERIFIED_BY test edge. */
  rule('REQUIRE_VERIFIED_TEST_EVIDENCE', {
    nodeKinds: z.array(NodeKindSchema).min(1).max(POLICY_LIMITS.maxNodeKinds).refine(uniq, 'nodeKinds must be unique')
  }),
  /** The plan's evidence must be re-checked and unchanged (EvidenceDrift.fresh) for this plan. */
  rule('INVALIDATE_ON_EVIDENCE_CHANGE', {}),
  /** The plan for this scenario must be COMPLETED (every approved action verified). */
  rule('BLOCK_INCOMPLETE_PLAN', {})
]);
export type PolicyRuleSpec = z.infer<typeof PolicyRuleSpec>;
export type PolicyRuleType = PolicyRuleSpec['type'];

export const PolicySet = z.object({
  schemaVersion: z.literal(POLICY_SCHEMA_VERSION),
  id: SafeId,
  scope: z.object({
    projectKeys: z.array(ProjectKey).min(1).max(POLICY_LIMITS.maxProjectKeys).refine(uniq, 'projectKeys must be unique')
  }).strict(),
  rules: z.array(PolicyRuleSpec).min(1).max(POLICY_LIMITS.maxRules).refine((rs) => uniq(rs.map((r) => r.id)), 'rule ids must be unique')
}).strict();
export type PolicySet = z.infer<typeof PolicySet>;

export class PolicySetError extends Error {
  constructor(readonly code: 'VALIDATION' | 'UNSUPPORTED_SCHEMA_VERSION', message: string, readonly issues: string[] = []) {
    super(`${code}: ${message}`);
    this.name = 'PolicySetError';
  }
}

/** Strictly validate a policy set of the current schema version. Unknown fields or rule types are rejected. */
export function validatePolicySet(raw: unknown): PolicySet {
  const r = PolicySet.safeParse(raw);
  if (!r.success) {
    const issues = r.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new PolicySetError('VALIDATION', 'invalid policy set', issues);
  }
  return r.data;
}

/**
 * Upgrade steps keyed by the version they upgrade FROM (n -> n+1). Empty while schemaVersion 1 is the only version.
 * Versions newer than POLICY_SCHEMA_VERSION are rejected, never guessed.
 */
const MIGRATIONS: Readonly<Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>> = {};

export function migratePolicySet(raw: unknown): PolicySet {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PolicySetError('VALIDATION', 'policy set must be an object');
  let doc = raw as Record<string, unknown>;
  const v = doc.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new PolicySetError('VALIDATION', 'schemaVersion must be a positive integer');
  if (v > POLICY_SCHEMA_VERSION) throw new PolicySetError('UNSUPPORTED_SCHEMA_VERSION', `schemaVersion ${v} is newer than supported version ${POLICY_SCHEMA_VERSION}`);
  for (let cur = v; cur < POLICY_SCHEMA_VERSION; cur++) {
    const step = MIGRATIONS[cur];
    if (!step) throw new PolicySetError('UNSUPPORTED_SCHEMA_VERSION', `no migration from schemaVersion ${cur}`);
    doc = step(doc);
  }
  return validatePolicySet(doc); // v1 -> v1 is the identity
}

// ---------- facts & results ----------
export interface PolicyFacts {
  /** Jira project key of the change; the set applies only if it is in scope.projectKeys. */
  projectKey: string;
  snapshot: GraphSnapshot;
  scenario: ScenarioDefinition;
  /** Result of simulate(snapshot, scenario, ...) for the same snapshot and scenario. */
  result: SimulationResult;
  /** Prevention plan for this scenario. undefined = not supplied (unknown); null = no plan exists. */
  plan?: PreventionPlan | null;
  /** Execution records of the plan, if known. */
  executions?: readonly ExecutionRecord[];
  /** Latest freshness check of the plan. undefined/null = never checked (unknown). */
  drift?: EvidenceDrift | null;
  /** Shared decision of the plan. undefined = not supplied (unknown); null = never shared (no approvals). */
  decision?: Pick<SharedDecision, 'proposer' | 'approvals' | 'planHash'> | null;
}

export type PolicyOutcome = 'PASS' | 'NEEDS_REVIEW' | 'BLOCK';
export interface PolicyRuleResult {
  ruleId: string; type: PolicyRuleType; outcome: PolicyOutcome;
  /** false when the rule's trigger condition does not hold for this change (outcome is then PASS). */
  applicable: boolean;
  explanation: string;
  /** Sorted, bounded refs: node:<id>, edge:<id>, violation:<ruleId>, plan:<id>@<hash>, drift:<planId>@<checkedAt>, approval:<accountId>, execution:<id>. */
  evidenceRefs: string[];
}
export interface PolicyEvaluation {
  policySetId: string; schemaVersion: typeof POLICY_SCHEMA_VERSION;
  /** PREVIEW results are informational only. ENFORCE is a label for a future caller; this module never enforces anything. */
  mode: 'PREVIEW' | 'ENFORCE';
  inScope: boolean;
  /** Worst outcome over all rules (PASS when out of scope). */
  overall: PolicyOutcome;
  results: PolicyRuleResult[];
  resultHash: string;
}

// ---------- helpers ----------
const RANK: Record<EvidenceStatus, number> = { CONFIRMED: 2, INFERRED: 1, UNKNOWN: 0 };
const OUTCOME_RANK: Record<PolicyOutcome, number> = { PASS: 0, NEEDS_REVIEW: 1, BLOCK: 2 };
const sortU = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const list = (ids: readonly string[], max = 10) => ids.length <= max ? ids.join(', ') : `${ids.slice(0, max).join(', ')} and ${ids.length - max} more`;
const clip = (s: string) => (s.length <= POLICY_LIMITS.maxExplanation ? s : `${s.slice(0, POLICY_LIMITS.maxExplanation - 1)}…`);
const refs = (xs: Iterable<string>) => sortU(xs).slice(0, POLICY_LIMITS.maxEvidenceRefs);
/** MIGRATE_DEPENDENTS rewrites edge ids as `<id>~migrated`; the evidence status is the original edge's. */
const baseEdgeId = (id: string) => id.replace(/(~migrated)+$/, '');

export function changeKindsOf(scenario: ScenarioDefinition): ChangeKind[] {
  return sortU(scenario.operations.map((o) => o.op === 'UPGRADE_NODE' ? (o.breaking ? 'UPGRADE_BREAKING' : 'UPGRADE_COMPATIBLE') : o.op)) as ChangeKind[];
}

interface Ctx {
  facts: PolicyFacts;
  nodes: ReadonlyMap<string, GraphSnapshot['nodes'][number]>;
  edges: ReadonlyMap<string, GraphSnapshot['edges'][number]>;
  kinds: ReadonlySet<ChangeKind>;
  /** Truncation or UNKNOWN edges on impact paths: the impact set may be incomplete or partly unverified. */
  impactGaps: string[];
  planRef: string | null;
}

/** Plan supplied and bound to this snapshot+scenario: 'MATCH'; supplied for another: 'MISMATCH'; null: 'NONE'; undefined: 'UNKNOWN'. */
function planBinding(f: PolicyFacts): 'MATCH' | 'MISMATCH' | 'NONE' | 'UNKNOWN' {
  if (f.plan === undefined) return 'UNKNOWN';
  if (f.plan === null) return 'NONE';
  return f.plan.snapshotId === f.snapshot.snapshotId && f.plan.scenarioId === f.scenario.scenarioId ? 'MATCH' : 'MISMATCH';
}

type Eval = Omit<PolicyRuleResult, 'ruleId' | 'type'>;
const res = (outcome: PolicyOutcome, explanation: string, evidenceRefs: Iterable<string> = [], applicable = true): Eval =>
  ({ outcome, applicable, explanation: clip(explanation), evidenceRefs: refs(evidenceRefs) });
const notApplicable = (why: string): Eval => res('PASS', `Not applicable: ${why}`, [], false);

// ---------- rules ----------
function dependencyReview(c: Ctx, minImpacted: number): Eval {
  const breaking = [...c.kinds].filter((k) => k === 'REMOVE_NODE' || k === 'UPGRADE_BREAKING');
  if (!breaking.length) return notApplicable('the scenario contains no breaking change (removal or breaking upgrade).');
  const impacted = c.facts.result.impacts.map((i) => i.nodeId);
  const impactRefs = impacted.map((n) => `node:${n}`);
  if (impacted.length < minImpacted) {
    if (c.impactGaps.length) return res('NEEDS_REVIEW', `Breaking change (${breaking.join(', ')}) impacts ${impacted.length} known item(s), below the threshold of ${minImpacted}, but the impact set is incomplete (${c.impactGaps.join('; ')}); the threshold may be reached.`, impactRefs);
    return notApplicable(`breaking change impacts ${impacted.length} item(s), below the threshold of ${minImpacted}.`);
  }
  const b = planBinding(c.facts);
  const head = `Breaking change (${breaking.join(', ')}) impacts ${impacted.length} item(s) (threshold ${minImpacted}): ${list(impacted)}.`;
  if (b === 'UNKNOWN') return res('NEEDS_REVIEW', `${head} Whether a dependency review (prevention plan) exists was not supplied.`, impactRefs);
  if (b === 'NONE') return res('BLOCK', `${head} No dependency review (prevention plan) exists for this scenario.`, impactRefs);
  const plan = c.facts.plan!;
  const all = [...impactRefs, c.planRef!];
  if (b === 'MISMATCH') return res('NEEDS_REVIEW', `${head} The supplied plan ${plan.planId} was built for another snapshot or scenario and does not count as a review of this one.`, all);
  if (plan.status === 'APPROVED' || plan.status === 'EXECUTING' || plan.status === 'COMPLETED') return res('PASS', `${head} Reviewed in plan ${plan.planId} (${plan.status}).`, all);
  return res('BLOCK', `${head} Plan ${plan.planId} is ${plan.status}; the dependency review has not been approved.`, all);
}

function independentApproval(c: Ctx, changeKinds: readonly ChangeKind[], minApprovers: number): Eval {
  const hit = changeKinds.filter((k) => c.kinds.has(k));
  if (!hit.length) return notApplicable(`the scenario contains none of ${changeKinds.join(', ')}.`);
  const head = `Change kinds ${hit.join(', ')} require ${minApprovers} independent approval(s).`;
  const b = planBinding(c.facts);
  if (b === 'UNKNOWN') return res('NEEDS_REVIEW', `${head} The plan was not supplied, so approvals cannot be bound to a plan version.`);
  if (b === 'NONE') return res('BLOCK', `${head} No plan exists to approve.`);
  const plan = c.facts.plan!;
  if (b === 'MISMATCH') return res('NEEDS_REVIEW', `${head} The supplied plan ${plan.planId} was built for another snapshot or scenario.`, [c.planRef!]);
  const d = c.facts.decision;
  if (d === undefined) return res('NEEDS_REVIEW', `${head} Approval records were not supplied.`, [c.planRef!]);
  if (d === null) return res('BLOCK', `${head} Plan ${plan.planId} has not been shared for approval (0 independent approvals).`, [c.planRef!]);
  if (d.planHash !== plan.planHash) return res('BLOCK', `${head} Recorded approvals are bound to plan version ${d.planHash}, not the current version ${plan.planHash}; they do not count.`, [c.planRef!]);
  const valid = sortU(d.approvals.filter((a) => a.planHash === plan.planHash && a.by !== d.proposer).map((a) => a.by));
  const selfOrStale = d.approvals.length - d.approvals.filter((a) => a.planHash === plan.planHash && a.by !== d.proposer).length;
  const why = selfOrStale ? ` ${selfOrStale} approval(s) by the proposer or for another plan version were not counted.` : '';
  const evidence = [c.planRef!, ...valid.map((a) => `approval:${a}`)];
  if (valid.length >= minApprovers) return res('PASS', `${head} ${valid.length} independent approval(s) on plan version ${plan.planHash}.${why}`, evidence);
  return res('BLOCK', `${head} Only ${valid.length} independent approval(s) on plan version ${plan.planHash}.${why}`, evidence);
}

function confirmedBlockers(c: Ctx): Eval {
  const impactStatus = new Map(c.facts.result.impacts.map((i) => [i.nodeId, i.weakestStatus]));
  const statusOfPath = (ids: readonly string[]): EvidenceStatus => ids.reduce<EvidenceStatus>((w, id) => {
    const s = c.edges.get(baseEdgeId(id))?.status ?? 'UNKNOWN';
    return RANK[s] < RANK[w] ? s : w;
  }, 'CONFIRMED');
  const confirmed: string[] = []; const weak: string[] = []; const evidence: string[] = [];
  for (const v of c.facts.result.violations.filter((x) => x.severity === 'BLOCKER')) {
    // A violation is confirmed when at least one affected node is reached on an all-CONFIRMED path (impact path status;
    // for violations not on an impact path, e.g. open work items, the weakest of the violation's own path edges).
    const fallback = v.pathEdgeIds.length ? statusOfPath(v.pathEdgeIds) : 'UNKNOWN';
    const isConfirmed = v.nodeIds.some((n) => (impactStatus.get(n) ?? fallback) === 'CONFIRMED');
    (isConfirmed ? confirmed : weak).push(v.ruleId);
    evidence.push(`violation:${v.ruleId}`, ...v.pathEdgeIds.map((e) => `edge:${e}`), ...v.nodeIds.map((n) => `node:${n}`));
  }
  if (confirmed.length) return res('BLOCK', `Blocking firewall rule(s) ${list(sortU(confirmed))} are violated on CONFIRMED evidence.`, evidence);
  if (weak.length) return res('NEEDS_REVIEW', `Blocking firewall rule(s) ${list(sortU(weak))} are violated on INFERRED or UNKNOWN evidence only; confirm the evidence.`, evidence);
  if (c.impactGaps.length) return res('NEEDS_REVIEW', `No blocking violation was found, but the impact set is incomplete (${c.impactGaps.join('; ')}); a blocker may be hidden.`, c.facts.result.uncertainties.filter((u) => u.edgeId).map((u) => `edge:${u.edgeId}`));
  return res('PASS', 'No blocking firewall rule is violated and every impact path is known.');
}

function verifiedTests(c: Ctx, nodeKinds: readonly string[]): Eval {
  const wanted = new Set(nodeKinds);
  const tests = new Map<string, EvidenceStatus>();
  for (const e of c.edges.values()) {
    if (e.kind !== 'VERIFIED_BY') continue;
    const prev = tests.get(e.from);
    if (!prev || RANK[e.status] > RANK[prev]) tests.set(e.from, e.status);
  }
  const missing: string[] = []; const unverified: string[] = []; const unknownKind: string[] = []; const ok: string[] = []; const evidence: string[] = [];
  for (const id of sortU(c.facts.result.impacts.map((i) => i.nodeId))) {
    const n = c.nodes.get(id);
    if (!n || n.status === 'UNKNOWN') { unknownKind.push(id); evidence.push(`node:${id}`); continue; }
    if (!wanted.has(n.kind)) continue;
    const t = tests.get(id);
    evidence.push(`node:${id}`);
    if (t === 'CONFIRMED') ok.push(id); else if (t) unverified.push(id); else missing.push(id);
  }
  for (const e of c.edges.values()) if (e.kind === 'VERIFIED_BY' && (ok.includes(e.from) || unverified.includes(e.from))) evidence.push(`edge:${e.id}`);
  const parts = [
    missing.length ? `no linked test for ${list(missing)}` : '',
    unverified.length ? `only INFERRED/UNKNOWN test links for ${list(unverified)}` : '',
    unknownKind.length ? `kind or status UNKNOWN for ${list(unknownKind)}` : '',
    c.impactGaps.length ? `impact set incomplete (${c.impactGaps.join('; ')})` : ''
  ].filter(Boolean);
  const head = `Impacted ${nodeKinds.join('/')} items need a CONFIRMED verifying test.`;
  if (missing.length) return res('BLOCK', `${head} ${parts.join('; ')}.`, evidence);
  if (parts.length) return res('NEEDS_REVIEW', `${head} ${parts.join('; ')}.`, evidence);
  if (!ok.length) return notApplicable(`no impacted item is of kind ${nodeKinds.join('/')}.`);
  return res('PASS', `${head} All ${ok.length} are verified: ${list(ok)}.`, evidence);
}

function evidenceChange(c: Ctx): Eval {
  const b = planBinding(c.facts);
  if (b === 'UNKNOWN') return res('NEEDS_REVIEW', 'The plan was not supplied; evidence freshness cannot be assessed.');
  if (b === 'NONE') return notApplicable('no plan exists, so there is no approved evidence to invalidate.');
  const plan = c.facts.plan!;
  if (plan.status === 'EVIDENCE_CHANGED' || plan.status === 'INVALIDATED') return res('BLOCK', `Plan ${plan.planId} is ${plan.status}: its evidence changed after it was built.`, [c.planRef!]);
  const d = c.facts.drift;
  if (!d) return res('NEEDS_REVIEW', `Plan ${plan.planId} has no recorded freshness check against live evidence.`, [c.planRef!]);
  const ev = [c.planRef!, `drift:${d.planId}@${d.checkedAt}`];
  if (d.planId !== plan.planId || d.snapshotId !== plan.snapshotId) return res('NEEDS_REVIEW', `The supplied freshness check belongs to plan ${d.planId} / snapshot ${d.snapshotId}, not plan ${plan.planId}.`, ev);
  if (!d.fresh) return res('BLOCK', `Evidence changed since plan ${plan.planId} was built: ${d.reason}`, [...ev, ...d.becameUnknown.map((n) => `node:${n}`)]);
  return res('PASS', `Live evidence matched plan ${plan.planId} at ${d.checkedAt}.`, ev);
}

function incompletePlan(c: Ctx): Eval {
  const b = planBinding(c.facts);
  if (b === 'UNKNOWN') return res('NEEDS_REVIEW', 'The plan was not supplied; completion cannot be assessed.');
  if (b === 'NONE') return res('BLOCK', 'No prevention plan exists for this scenario.');
  const plan = c.facts.plan!;
  if (b === 'MISMATCH') return res('NEEDS_REVIEW', `Plan ${plan.planId} was built for another snapshot or scenario.`, [c.planRef!]);
  if (plan.status !== 'COMPLETED') return res('BLOCK', `Plan ${plan.planId} is ${plan.status}, not COMPLETED.`, [c.planRef!]);
  const ex = c.facts.executions;
  if (ex === undefined) return res('PASS', `Plan ${plan.planId} is COMPLETED (every approved action verified, per plan status).`, [c.planRef!]);
  const own = ex.filter((e) => e.planId === plan.planId);
  const open = own.filter((e) => e.status !== 'VERIFIED' && e.status !== 'SKIPPED');
  const ev = [c.planRef!, ...own.map((e) => `execution:${e.executionId}`)];
  if (open.length) return res('BLOCK', `Plan ${plan.planId} is COMPLETED but ${open.length} execution(s) are not verified: ${list(sortU(open.map((e) => `${e.actionId} (${e.status})`)))}.`, ev);
  return res('PASS', `Plan ${plan.planId} is COMPLETED and all ${own.length} execution record(s) are VERIFIED or SKIPPED.`, ev);
}

// ---------- evaluation ----------
function assertFacts(f: PolicyFacts) {
  if (f.result.snapshotId !== f.snapshot.snapshotId) throw new PolicySetError('VALIDATION', `result is for snapshot ${f.result.snapshotId}, not ${f.snapshot.snapshotId}`);
  if (f.result.scenarioId !== f.scenario.scenarioId) throw new PolicySetError('VALIDATION', `result is for scenario ${f.result.scenarioId}, not ${f.scenario.scenarioId}`);
}

export function evaluatePolicySet(set: PolicySet, facts: PolicyFacts, opts: { mode?: 'PREVIEW' | 'ENFORCE' } = {}): PolicyEvaluation {
  const valid = validatePolicySet(set);
  assertFacts(facts);
  const mode = opts.mode ?? 'PREVIEW';
  const inScope = valid.scope.projectKeys.includes(facts.projectKey);
  const results: PolicyRuleResult[] = [];
  if (inScope) {
    const impactGaps: string[] = [];
    const unknownPaths = facts.result.impacts.filter((i) => i.weakestStatus === 'UNKNOWN').length;
    if (unknownPaths) impactGaps.push(`${unknownPaths} impact path(s) with UNKNOWN evidence`);
    if (facts.result.uncertainties.some((u) => u.reason === 'TRUNCATED') || facts.snapshot.truncated) impactGaps.push('traversal or snapshot truncated');
    const ctx: Ctx = {
      facts,
      nodes: new Map(facts.snapshot.nodes.map((n) => [n.id, n])),
      edges: new Map([...facts.snapshot.edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((e) => [e.id, e])),
      kinds: new Set(changeKindsOf(facts.scenario)),
      impactGaps,
      planRef: facts.plan ? `plan:${facts.plan.planId}@${facts.plan.planHash}` : null
    };
    for (const r of valid.rules) {
      let e: Eval;
      switch (r.type) {
        case 'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING': e = dependencyReview(ctx, r.minImpacted); break;
        case 'REQUIRE_INDEPENDENT_APPROVAL': e = independentApproval(ctx, r.changeKinds, r.minApprovers); break;
        case 'BLOCK_WITH_CONFIRMED_BLOCKERS': e = confirmedBlockers(ctx); break;
        case 'REQUIRE_VERIFIED_TEST_EVIDENCE': e = verifiedTests(ctx, r.nodeKinds); break;
        case 'INVALIDATE_ON_EVIDENCE_CHANGE': e = evidenceChange(ctx); break;
        case 'BLOCK_INCOMPLETE_PLAN': e = incompletePlan(ctx); break;
      }
      results.push({ ruleId: r.id, type: r.type, ...e });
    }
  }
  const overall = results.reduce<PolicyOutcome>((w, r) => (OUTCOME_RANK[r.outcome] > OUTCOME_RANK[w] ? r.outcome : w), 'PASS');
  const body = { policySetId: valid.id, schemaVersion: POLICY_SCHEMA_VERSION, mode, inScope, overall, results };
  return { ...body, resultHash: stableHash(body) };
}

/** Evaluation without the enforcement label. The only entry point the product may use today. */
export function previewPolicySet(set: PolicySet, facts: PolicyFacts): PolicyEvaluation {
  return evaluatePolicySet(set, facts, { mode: 'PREVIEW' });
}
