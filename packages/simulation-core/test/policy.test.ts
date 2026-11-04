import {
  evaluatePolicySet, previewPolicySet, migratePolicySet, validatePolicySet, changeKindsOf, PolicySetError, PolicyRuleSpec,
  POLICY_NODE_KINDS, POLICY_LIMITS, type PolicyFacts, type PolicySet, type PolicyRuleResult
} from '../src/policy';
import { simulate } from '../src/index';
import { NodeKind } from '../../contracts/src/index';
import type { EdgeKind, EvidenceDrift, EvidenceStatus, ExecutionRecord, GraphSnapshot, PreventionPlan, ScenarioDefinition } from '../../contracts/src/index';
import { FIXTURE_POLICIES, FIXTURE_SCENARIOS, FIXTURE_SNAPSHOT } from '../../contracts/src/fixtures';

// ---------- helpers ----------
const T = '2026-11-04T10:00:00.000Z';
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
type N = [id: string, kind?: Kind, status?: EvidenceStatus];
type E = [from: string, to: string, kind?: EdgeKind, status?: EvidenceStatus];
type Kind = (typeof POLICY_NODE_KINDS)[number];
function graph(nodes: N[], edges: E[], id = 'g1'): GraphSnapshot {
  return {
    snapshotId: id, projectId: 'p', createdAt: T, expiresAt: '2026-11-05T10:00:00.000Z', mode: 'DEMO_FIXTURE', truncated: false, limits: { maxDepth: 6, maxNodes: 500 },
    nodes: nodes.map(([nid, kind = 'SERVICE', status = 'CONFIRMED']) => ({ id: nid, kind, label: nid, status, attributes: {}, references: [] })),
    edges: edges.map(([from, to, kind = 'USES', status = 'CONFIRMED'], i) => ({ id: `e${i}`, from, to, kind, status, references: [], accessLimited: false }))
  };
}
/** core <- a, core <- b (USES, CONFIRMED); a is verified by a confirmed test. */
const BASE_NODES: N[] = [['core'], ['a'], ['b'], ['test-a', 'TEST']];
const BASE_EDGES: E[] = [['a', 'core'], ['b', 'core'], ['a', 'test-a', 'VERIFIED_BY']];
const BASE = graph(BASE_NODES, BASE_EDGES);
const REMOVE: ScenarioDefinition = { scenarioId: 'S-remove', label: 'remove', operations: [{ op: 'REMOVE_NODE', nodeId: 'core' }] };
const DEPRECATE: ScenarioDefinition = { scenarioId: 'S-dep', label: 'deprecate', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'core', retainUntil: null }] };

function facts(snapshot: GraphSnapshot, scenario: ScenarioDefinition, extra: Partial<PolicyFacts> = {}): PolicyFacts {
  return { projectKey: 'PAY', snapshot, scenario, result: simulate(snapshot, scenario, FIXTURE_POLICIES), ...extra };
}
function plan(status: PreventionPlan['status'], f: { snapshot: GraphSnapshot; scenario: ScenarioDefinition }, planHash = 'h-current'): PreventionPlan {
  return { planId: 'plan-1', snapshotId: f.snapshot.snapshotId, scenarioId: f.scenario.scenarioId, createdAt: T, status, actions: [], planHash };
}
const exec = (actionId: string, status: ExecutionRecord['status']): ExecutionRecord =>
  ({ executionId: `x-${actionId}`, planId: 'plan-1', actionId, status, attempt: 1, idempotencyKey: 'k', resultRef: null, error: null, updatedAt: T });
const drift = (fresh: boolean, planId = 'plan-1', snapshotId = 'g1'): EvidenceDrift =>
  ({ planId, snapshotId, checkedAt: T, fresh, addedEdges: [], removedEdges: [], becameUnknown: fresh ? [] : ['b'], ignoredPlanArtifacts: [], reason: fresh ? 'Live Jira evidence matches.' : 'Evidence changed since the snapshot: 1 item(s) no longer readable.' });
function set(...rules: PolicySet['rules']): PolicySet { return { schemaVersion: 1, id: 'team-policy', scope: { projectKeys: ['PAY'] }, rules }; }
function one(rule: PolicySet['rules'][number], f: PolicyFacts): PolicyRuleResult {
  const r = previewPolicySet(set(rule), f).results[0]!;
  expect(r.explanation.length).toBeGreaterThan(10);
  expect(r.explanation.length).toBeLessThanOrEqual(POLICY_LIMITS.maxExplanation);
  return r;
}

// ---------- schema ----------
describe('policy-as-code: schema, validation, migration', () => {
  const valid = set({ id: 'R1', type: 'BLOCK_WITH_CONFIRMED_BLOCKERS' });

  it('node kinds mirror the contract; the rule vocabulary is closed (6 types)', () => {
    expect([...POLICY_NODE_KINDS]).toEqual(NodeKind.options);
    expect(PolicyRuleSpec.options.map((o) => o.shape.type.value).sort()).toEqual([
      'BLOCK_INCOMPLETE_PLAN', 'BLOCK_WITH_CONFIRMED_BLOCKERS', 'INVALIDATE_ON_EVIDENCE_CHANGE',
      'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', 'REQUIRE_INDEPENDENT_APPROVAL', 'REQUIRE_VERIFIED_TEST_EVIDENCE']);
  });

  it('accepts a valid set; v1 migration is the identity', () => {
    expect(validatePolicySet(valid)).toEqual(valid);
    expect(migratePolicySet(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  const rejects = (raw: unknown, code: 'VALIDATION' | 'UNSUPPORTED_SCHEMA_VERSION' = 'VALIDATION') => {
    try { migratePolicySet(raw); } catch (e) { expect(e).toBeInstanceOf(PolicySetError); expect((e as PolicySetError).code).toBe(code); return; }
    throw new Error('expected rejection');
  };

  it('rejects unknown rule types', () => rejects({ ...valid, rules: [{ id: 'R1', type: 'RUN_SCRIPT', script: 'return true' }] }));
  it('rejects extra fields (expressions smuggled as parameters) on rules, scope and set', () => {
    rejects({ ...valid, rules: [{ id: 'R1', type: 'BLOCK_WITH_CONFIRMED_BLOCKERS', when: 'impacted > 3' }] });
    rejects({ ...valid, rules: [{ id: 'R1', type: 'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', minImpacted: 2, filter: '(n) => n.kind' }] });
    rejects({ ...valid, scope: { projectKeys: ['PAY'], jql: 'project = PAY' } });
    rejects({ ...valid, onEvaluate: 'fetch("https://x")' });
  });
  it('rejects code-like strings in ids and project keys', () => {
    for (const id of ['x;process.exit()', '${env.SECRET}', '<script>', 'a b', 'require("fs")', '']) rejects({ ...valid, rules: [{ id, type: 'BLOCK_WITH_CONFIRMED_BLOCKERS' }] });
    rejects({ ...valid, id: 'eval(1)' });
    rejects({ ...valid, scope: { projectKeys: ['PAY OR 1=1'] } });
  });
  it('rejects code where a typed parameter is expected', () => {
    rejects({ ...valid, rules: [{ id: 'R1', type: 'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', minImpacted: 'impacted.length' }] });
    rejects({ ...valid, rules: [{ id: 'R1', type: 'REQUIRE_INDEPENDENT_APPROVAL', changeKinds: ['ANY'], minApprovers: 1 }] });
    rejects({ ...valid, rules: [{ id: 'R1', type: 'REQUIRE_VERIFIED_TEST_EVIDENCE', nodeKinds: ['SERVICE', 'SERVICE'] }] });
  });
  it('enforces bounds: max 50 rules, unique rule ids, minApprovers 1..3, non-empty scope', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `R${i}`, type: 'BLOCK_INCOMPLETE_PLAN' as const }));
    expect(validatePolicySet({ ...valid, rules: many(50) }).rules).toHaveLength(50);
    rejects({ ...valid, rules: many(51) });
    rejects({ ...valid, rules: [{ id: 'R1', type: 'BLOCK_INCOMPLETE_PLAN' }, { id: 'R1', type: 'BLOCK_WITH_CONFIRMED_BLOCKERS' }] });
    rejects({ ...valid, rules: [{ id: 'R1', type: 'REQUIRE_INDEPENDENT_APPROVAL', changeKinds: ['REMOVE_NODE'], minApprovers: 4 }] });
    rejects({ ...valid, rules: [] });
    rejects({ ...valid, scope: { projectKeys: [] } });
  });
  it('unknown future schema versions are rejected, never guessed; missing/invalid versions are invalid', () => {
    rejects({ ...valid, schemaVersion: 2 }, 'UNSUPPORTED_SCHEMA_VERSION');
    rejects({ ...valid, schemaVersion: 99 }, 'UNSUPPORTED_SCHEMA_VERSION');
    const { schemaVersion: _drop, ...noVersion } = valid;
    rejects(noVersion);
    rejects({ ...valid, schemaVersion: '1' });
    rejects({ ...valid, schemaVersion: 0 });
    rejects(null); rejects([valid]); rejects('schemaVersion: 1');
  });
  it('evaluate re-validates its input and rejects inconsistent facts', () => {
    expect(() => previewPolicySet({ ...valid, rules: [{ id: 'R1', type: 'NOPE' }] } as unknown as PolicySet, facts(BASE, REMOVE))).toThrow(PolicySetError);
    const f = facts(BASE, REMOVE);
    expect(() => previewPolicySet(valid, { ...f, scenario: DEPRECATE })).toThrow(/scenario/);
    expect(() => previewPolicySet(valid, { ...f, snapshot: { ...BASE, snapshotId: 'other' } })).toThrow(/snapshot/);
  });
});

// ---------- rules ----------
describe('rule REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', () => {
  const R = { id: 'DR', type: 'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING' as const, minImpacted: 2 };
  it('PASS (not applicable) for non-breaking changes and below threshold', () => {
    expect(one(R, facts(BASE, DEPRECATE))).toMatchObject({ outcome: 'PASS', applicable: false });
    expect(one({ ...R, minImpacted: 3 }, facts(BASE, REMOVE))).toMatchObject({ outcome: 'PASS', applicable: false });
  });
  it('BLOCK without a reviewed plan; PASS with an approved plan for this scenario', () => {
    const f = facts(BASE, REMOVE);
    expect(one(R, { ...f, plan: null }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: plan('PENDING_APPROVAL', f) }).outcome).toBe('BLOCK');
    const ok = one(R, { ...f, plan: plan('APPROVED', f) });
    expect(ok).toMatchObject({ outcome: 'PASS', applicable: true });
    expect(ok.evidenceRefs).toEqual(['node:a', 'node:b', 'plan:plan-1@h-current']);
  });
  it('NEEDS_REVIEW when the plan is unknown, belongs to another scenario, or the impact set is incomplete', () => {
    const f = facts(BASE, REMOVE);
    expect(one(R, f).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, { ...f, plan: plan('APPROVED', { snapshot: BASE, scenario: DEPRECATE }) }).outcome).toBe('NEEDS_REVIEW');
    const g = graph([...BASE_NODES, ['c']], [...BASE_EDGES, ['c', 'core', 'USES', 'UNKNOWN']]);
    const r = one({ ...R, minImpacted: 4 }, facts(g, REMOVE, { plan: null }));
    expect(r.outcome).toBe('NEEDS_REVIEW');
    expect(r.explanation).toMatch(/UNKNOWN/);
  });
});

describe('rule REQUIRE_INDEPENDENT_APPROVAL', () => {
  const R = { id: 'IA', type: 'REQUIRE_INDEPENDENT_APPROVAL' as const, changeKinds: ['REMOVE_NODE' as const], minApprovers: 1 };
  const f = facts(BASE, REMOVE);
  const p = plan('APPROVED', f);
  it('PASS (not applicable) for other change kinds', () => expect(one(R, facts(BASE, DEPRECATE))).toMatchObject({ outcome: 'PASS', applicable: false }));
  it('PASS with an approval by someone other than the proposer on the current plan hash', () => {
    const r = one(R, { ...f, plan: p, decision: { proposer: 'alice', planHash: 'h-current', approvals: [{ by: 'bob', at: T, planHash: 'h-current' }] } });
    expect(r.outcome).toBe('PASS');
    expect(r.evidenceRefs).toContain('approval:bob');
  });
  it('BLOCK on self-approval, stale-hash approvals, unshared plan, or no plan', () => {
    expect(one(R, { ...f, plan: p, decision: { proposer: 'alice', planHash: 'h-current', approvals: [{ by: 'alice', at: T, planHash: 'h-current' }] } })).toMatchObject({ outcome: 'BLOCK', explanation: expect.stringMatching(/not counted/) });
    expect(one(R, { ...f, plan: p, decision: { proposer: 'alice', planHash: 'h-current', approvals: [{ by: 'bob', at: T, planHash: 'h-old' }] } }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: p, decision: { proposer: 'alice', planHash: 'h-old', approvals: [{ by: 'bob', at: T, planHash: 'h-old' }] } }).outcome).toBe('BLOCK');
    expect(one({ ...R, minApprovers: 2 }, { ...f, plan: p, decision: { proposer: 'alice', planHash: 'h-current', approvals: [{ by: 'bob', at: T, planHash: 'h-current' }, { by: 'bob', at: T, planHash: 'h-current' }] } }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: p, decision: null }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: null }).outcome).toBe('BLOCK');
  });
  it('NEEDS_REVIEW when the plan or approval records are not supplied (unknown)', () => {
    expect(one(R, f).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, { ...f, plan: p }).outcome).toBe('NEEDS_REVIEW');
  });
  it('derives change kinds from operations (breaking flag splits upgrades)', () => {
    expect(changeKindsOf({ scenarioId: 's', label: 's', operations: [{ op: 'UPGRADE_NODE', nodeId: 'a', breaking: true }, { op: 'UPGRADE_NODE', nodeId: 'b', breaking: false }, { op: 'REMOVE_NODE', nodeId: 'c' }] }))
      .toEqual(['REMOVE_NODE', 'UPGRADE_BREAKING', 'UPGRADE_COMPATIBLE']);
  });
});

describe('rule BLOCK_WITH_CONFIRMED_BLOCKERS', () => {
  const R = { id: 'CB', type: 'BLOCK_WITH_CONFIRMED_BLOCKERS' as const };
  it('BLOCK when a BLOCKER firewall rule (P1) is violated on CONFIRMED evidence', () => {
    const r = one(R, facts(BASE, REMOVE));
    expect(r.outcome).toBe('BLOCK');
    expect(r.evidenceRefs).toEqual(expect.arrayContaining(['violation:P1', 'node:a', 'edge:e0']));
  });
  it('NEEDS_REVIEW when the blocker rests on INFERRED evidence only', () => {
    const g = graph([['core'], ['a']], [['a', 'core', 'USES', 'INFERRED']]);
    expect(one(R, facts(g, REMOVE)).outcome).toBe('NEEDS_REVIEW');
  });
  it('NEEDS_REVIEW (UNKNOWN never PASS) when no blocker but an impact path is UNKNOWN', () => {
    const g = graph([['core'], ['a'], ['c']], [['a', 'core'], ['c', 'core', 'USES', 'UNKNOWN']]);
    const r = one(R, facts(g, DEPRECATE));
    expect(r.outcome).toBe('NEEDS_REVIEW');
    expect(r.explanation).toMatch(/blocker may be hidden/);
  });
  it('NEEDS_REVIEW when the traversal was truncated', () => {
    const g = graph([['core'], ['a'], ['b']], [['a', 'core'], ['b', 'a']]);
    const f: PolicyFacts = { projectKey: 'PAY', snapshot: g, scenario: DEPRECATE, result: simulate(g, DEPRECATE, FIXTURE_POLICIES, 1) };
    expect(one(R, f).outcome).toBe('NEEDS_REVIEW');
  });
  it('PASS when no blocker and every impact path is known', () => expect(one(R, facts(BASE, DEPRECATE))).toMatchObject({ outcome: 'PASS', applicable: true }));
});

describe('rule REQUIRE_VERIFIED_TEST_EVIDENCE', () => {
  const R = { id: 'VT', type: 'REQUIRE_VERIFIED_TEST_EVIDENCE' as const, nodeKinds: ['SERVICE' as const] };
  it('BLOCK when an impacted service has no linked test', () => {
    const r = one(R, facts(BASE, DEPRECATE));
    expect(r.outcome).toBe('BLOCK');
    expect(r.explanation).toMatch(/no linked test for b/);
  });
  it('PASS when every impacted service has a CONFIRMED test', () => {
    const g = graph([...BASE_NODES, ['test-b', 'TEST']], [...BASE_EDGES, ['b', 'test-b', 'VERIFIED_BY']]);
    expect(one(R, facts(g, DEPRECATE))).toMatchObject({ outcome: 'PASS', applicable: true });
  });
  it('NEEDS_REVIEW when a test link is only INFERRED, or an impacted node is UNKNOWN', () => {
    const g = graph([...BASE_NODES, ['test-b', 'TEST']], [...BASE_EDGES, ['b', 'test-b', 'VERIFIED_BY', 'INFERRED']]);
    expect(one(R, facts(g, DEPRECATE)).outcome).toBe('NEEDS_REVIEW');
    const u = graph([['core'], ['a'], ['test-a', 'TEST'], ['x', 'SERVICE', 'UNKNOWN']], [['a', 'core'], ['a', 'test-a', 'VERIFIED_BY'], ['x', 'core']]);
    expect(one(R, facts(u, DEPRECATE))).toMatchObject({ outcome: 'NEEDS_REVIEW', explanation: expect.stringMatching(/UNKNOWN for x/) });
  });
  it('PASS (not applicable) when no impacted item has a listed kind', () => {
    expect(one({ ...R, nodeKinds: ['RELEASE'] }, facts(BASE, DEPRECATE))).toMatchObject({ outcome: 'PASS', applicable: false });
  });
});

describe('rule INVALIDATE_ON_EVIDENCE_CHANGE', () => {
  const R = { id: 'EV', type: 'INVALIDATE_ON_EVIDENCE_CHANGE' as const };
  const f = facts(BASE, REMOVE);
  const p = plan('APPROVED', f);
  it('PASS when the latest freshness check of this plan is fresh', () => expect(one(R, { ...f, plan: p, drift: drift(true) }).outcome).toBe('PASS'));
  it('BLOCK when evidence drifted or the plan is invalidated', () => {
    const r = one(R, { ...f, plan: p, drift: drift(false) });
    expect(r.outcome).toBe('BLOCK');
    expect(r.evidenceRefs).toContain('node:b');
    expect(one(R, { ...f, plan: plan('INVALIDATED', f), drift: drift(true) }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: plan('EVIDENCE_CHANGED', f) }).outcome).toBe('BLOCK');
  });
  it('NEEDS_REVIEW when freshness is unknown (never checked, plan unknown, or check of another plan)', () => {
    expect(one(R, { ...f, plan: p }).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, { ...f, plan: p, drift: null }).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, f).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, { ...f, plan: p, drift: drift(true, 'plan-2') }).outcome).toBe('NEEDS_REVIEW');
  });
  it('PASS (not applicable) when no plan exists', () => expect(one(R, { ...f, plan: null })).toMatchObject({ outcome: 'PASS', applicable: false }));
});

describe('rule BLOCK_INCOMPLETE_PLAN', () => {
  const R = { id: 'IP', type: 'BLOCK_INCOMPLETE_PLAN' as const };
  const f = facts(BASE, REMOVE);
  it('PASS for a COMPLETED plan (with all executions verified or skipped)', () => {
    expect(one(R, { ...f, plan: plan('COMPLETED', f) }).outcome).toBe('PASS');
    expect(one(R, { ...f, plan: plan('COMPLETED', f), executions: [exec('a1', 'VERIFIED'), exec('a2', 'SKIPPED')] }).outcome).toBe('PASS');
  });
  it('BLOCK for missing, incomplete or inconsistent plans', () => {
    expect(one(R, { ...f, plan: null }).outcome).toBe('BLOCK');
    for (const s of ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'PARTIAL', 'FAILED', 'EXPIRED'] as const) expect(one(R, { ...f, plan: plan(s, f) }).outcome).toBe('BLOCK');
    expect(one(R, { ...f, plan: plan('COMPLETED', f), executions: [exec('a1', 'VERIFIED'), exec('a2', 'FAILED')] })).toMatchObject({ outcome: 'BLOCK', explanation: expect.stringMatching(/a2 \(FAILED\)/) });
  });
  it('NEEDS_REVIEW when the plan is unknown or for another scenario', () => {
    expect(one(R, f).outcome).toBe('NEEDS_REVIEW');
    expect(one(R, { ...f, plan: plan('COMPLETED', { snapshot: BASE, scenario: DEPRECATE }) }).outcome).toBe('NEEDS_REVIEW');
  });
});

// ---------- evaluation ----------
describe('evaluatePolicySet / previewPolicySet', () => {
  const ALL = set(
    { id: 'DR', type: 'REQUIRE_DEPENDENCY_REVIEW_FOR_BREAKING', minImpacted: 1 },
    { id: 'IA', type: 'REQUIRE_INDEPENDENT_APPROVAL', changeKinds: ['REMOVE_NODE', 'UPGRADE_BREAKING'], minApprovers: 1 },
    { id: 'CB', type: 'BLOCK_WITH_CONFIRMED_BLOCKERS' },
    { id: 'VT', type: 'REQUIRE_VERIFIED_TEST_EVIDENCE', nodeKinds: ['SERVICE'] },
    { id: 'EV', type: 'INVALIDATE_ON_EVIDENCE_CHANGE' },
    { id: 'IP', type: 'BLOCK_INCOMPLETE_PLAN' }
  );
  const fixtureFacts = (): PolicyFacts => ({ projectKey: 'PAY', snapshot: FIXTURE_SNAPSHOT, scenario: FIXTURE_SCENARIOS[0]!, result: simulate(FIXTURE_SNAPSHOT, FIXTURE_SCENARIOS[0]!, FIXTURE_POLICIES) });

  it('preview: one result per rule in declared order, each explained; overall is the worst outcome; PREVIEW label', () => {
    const r = previewPolicySet(ALL, fixtureFacts());
    expect(r.mode).toBe('PREVIEW');
    expect(r.inScope).toBe(true);
    expect(r.results.map((x) => x.ruleId)).toEqual(['DR', 'IA', 'CB', 'VT', 'EV', 'IP']);
    for (const x of r.results) { expect(x.explanation.trim().length).toBeGreaterThan(10); expect(x.evidenceRefs).toEqual([...x.evidenceRefs].sort()); }
    expect(r.overall).toBe('BLOCK');
    expect(r.results.find((x) => x.ruleId === 'CB')!.outcome).toBe('BLOCK'); // checkout/mobile depend on auth v1 (CONFIRMED)
    expect(evaluatePolicySet(ALL, fixtureFacts(), { mode: 'ENFORCE' }).mode).toBe('ENFORCE');
  });

  it('with no plan/drift/approval facts, plan-dependent rules are NEEDS_REVIEW, never PASS', () => {
    const r = previewPolicySet(set({ id: 'IA', type: 'REQUIRE_INDEPENDENT_APPROVAL', changeKinds: ['REMOVE_NODE'], minApprovers: 1 }, { id: 'EV', type: 'INVALIDATE_ON_EVIDENCE_CHANGE' }, { id: 'IP', type: 'BLOCK_INCOMPLETE_PLAN' }), facts(BASE, REMOVE));
    expect(r.results.map((x) => x.outcome)).toEqual(['NEEDS_REVIEW', 'NEEDS_REVIEW', 'NEEDS_REVIEW']);
    expect(r.overall).toBe('NEEDS_REVIEW');
  });

  it('out of scope: no rule results, overall PASS, inScope false', () => {
    const r = previewPolicySet(ALL, { ...fixtureFacts(), projectKey: 'OPS' });
    expect(r).toMatchObject({ inScope: false, overall: 'PASS', results: [] });
  });

  it('deterministic: same output and hash on repeat and with shuffled snapshot nodes/edges; inputs not mutated', () => {
    const f = deepFreeze(fixtureFacts());
    const a = previewPolicySet(deepFreeze(structuredClone(ALL)), f);
    const b = previewPolicySet(ALL, f);
    const shuffled = { ...f, snapshot: { ...f.snapshot, nodes: [...f.snapshot.nodes].reverse(), edges: [...f.snapshot.edges].reverse() } };
    const c = previewPolicySet(ALL, shuffled);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.resultHash).toMatch(/^[0-9a-f]{16}$/);
  });
});
