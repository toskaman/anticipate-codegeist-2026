import type { ScenarioDefinition } from '../../packages/contracts/src/index';

/** The three flagship counterfactuals for retiring `targetNodeId` (C only when a replacement is known). */
export function standardScenarios(targetNodeId: string, replacementNodeId?: string | null, retainUntil: string | null = null): ScenarioDefinition[] {
  const s: ScenarioDefinition[] = [
    { scenarioId: 'A-remove-now', label: 'Remove now', operations: [{ op: 'REMOVE_NODE', nodeId: targetNodeId }] },
    { scenarioId: 'B-retain-temporarily', label: 'Retain temporarily during transition', operations: [{ op: 'DEPRECATE_NODE', nodeId: targetNodeId, retainUntil }] }
  ];
  if (replacementNodeId) s.push({ scenarioId: 'C-migrate-then-retire', label: 'Migrate consumers first, then retire', operations: [
    { op: 'MIGRATE_DEPENDENTS', fromNodeId: targetNodeId, toNodeId: replacementNodeId, edgeKinds: ['USES', 'DEPENDS_ON'] },
    { op: 'REMOVE_NODE', nodeId: targetNodeId }
  ] });
  return s;
}
