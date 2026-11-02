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

/** Dependency upgrade counterfactuals: breaking upgrade now, compatible upgrade (shim), or migrate consumers first. */
export function upgradeScenarios(targetNodeId: string, replacementNodeId?: string | null): ScenarioDefinition[] {
  const s: ScenarioDefinition[] = [
    { scenarioId: 'A-breaking-upgrade-now', label: 'Ship the breaking upgrade now', operations: [{ op: 'UPGRADE_NODE', nodeId: targetNodeId, breaking: true }] },
    { scenarioId: 'B-compatible-upgrade', label: 'Ship behind a backward-compatible shim', operations: [{ op: 'UPGRADE_NODE', nodeId: targetNodeId, breaking: false }] }
  ];
  if (replacementNodeId) s.push({ scenarioId: 'C-migrate-then-upgrade', label: 'Move consumers to the new version first, then upgrade', operations: [
    { op: 'MIGRATE_DEPENDENTS', fromNodeId: targetNodeId, toNodeId: replacementNodeId, edgeKinds: ['USES', 'DEPENDS_ON'] },
    { op: 'UPGRADE_NODE', nodeId: targetNodeId, breaking: true }
  ] });
  return s;
}
