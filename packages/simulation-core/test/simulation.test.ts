import { simulate, compareScenarios, computeImpacts, applyScenario, stableHash } from '../src/index';
import { FIXTURE_SNAPSHOT as S, FIXTURE_SCENARIOS as SC, FIXTURE_POLICIES as P } from '../../contracts/src/fixtures';
import { SimulationResult, ScenarioComparison, GraphSnapshot } from '../../contracts/src/index';

const [A, B, C] = SC as [typeof SC[0], typeof SC[0], typeof SC[0]];

describe('simulation-core ground truth (fixture)', () => {
  it('A: removal now is BLOCKED with direct + transitive impacts', () => {
    const r = SimulationResult.parse(simulate(S, A, P));
    expect(r.impacts.map((i) => [i.nodeId, i.depth])).toEqual([
      ['svc-batch-export', 1], ['svc-checkout', 1], ['svc-mobile', 1], ['svc-reporting', 1], ['svc-partner-webhooks', 2]]);
    expect(r.verdict).toBe('BLOCKED');
    expect(r.violations.map((v) => v.ruleId)).toEqual(['P1', 'P2', 'P3']);
    expect(r.violations[0]!.nodeIds).toEqual(['svc-checkout', 'svc-mobile', 'svc-reporting']); // UNKNOWN not treated as confirmed
    expect(r.impacts.find((i) => i.nodeId === 'svc-partner-webhooks')!.pathEdgeIds).toEqual(['e1', 'e5']);
  });
  it('B: deprecation only triggers test-coverage review, no removal rules', () => {
    const r = simulate(S, B, P);
    expect(r.verdict).toBe('NEEDS_REVIEW');
    expect(r.violations.map((v) => v.ruleId)).toEqual(['P3']);
  });
  it('C: migration leaves only the unknown consumer attached', () => {
    const r = simulate(S, C, P);
    expect(r.impacts.map((i) => i.nodeId)).toEqual(['svc-batch-export']);
    expect(r.violations.map((v) => v.ruleId)).toEqual(['P2', 'P3']);
    expect(r.verdict).toBe('NEEDS_REVIEW');
  });
  it('comparison is deterministic and recommends a scenario with reasons', () => {
    const c1 = ScenarioComparison.parse(compareScenarios(S, SC, P));
    const c2 = compareScenarios(S, SC, P);
    expect(c1.results.map((r) => r.resultHash)).toEqual(c2.results.map((r) => r.resultHash));
    expect(c1.recommendedScenarioId).toBe('B-retain-temporarily');
    expect(new Set(c1.results.map((r) => r.resultHash)).size).toBe(3);
  });
  it('does not mutate the snapshot', () => {
    const before = stableHash(S);
    compareScenarios(S, SC, P);
    expect(stableHash(S)).toBe(before);
  });
  it('handles cycles and depth limits', () => {
    const cyc: GraphSnapshot = { ...S, edges: [...S.edges, { id: 'cyc', from: 'svc-auth-v1', to: 'svc-partner-webhooks', kind: 'DEPENDS_ON', status: 'CONFIRMED', references: [], accessLimited: false }] };
    const r = simulate(cyc, A, P);
    expect(r.impacts.length).toBe(5);
    const g = applyScenario(S, A);
    const t = computeImpacts(g, ['svc-auth-v1'], 1);
    expect(t.truncated).toBe(true);
    expect(simulate(S, A, P, 1).uncertainties.some((u) => u.reason === 'TRUNCATED')).toBe(true);
  });
  it('rejects unknown nodes', () => {
    expect(() => simulate(S, { scenarioId: 'x', label: 'x', operations: [{ op: 'REMOVE_NODE', nodeId: 'nope' }] }, P)).toThrow(/VALIDATION/);
  });
});
