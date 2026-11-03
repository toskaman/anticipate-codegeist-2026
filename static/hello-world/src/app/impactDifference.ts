import type { SimulationResult } from "@anticipate/contracts";

/** Compare supplied records, not predictions. Missing impacts never mean "safe". */
export function impactDifference(
  left: SimulationResult,
  right: SimulationResult,
) {
  if (
    left.snapshotId !== right.snapshotId ||
    left.scenarioId === right.scenarioId
  )
    return null;
  const a = new Set(left.impacts.map((impact) => impact.nodeId));
  const b = new Set(right.impacts.map((impact) => impact.nodeId));
  const rulesA = new Set(left.violations.map((rule) => rule.ruleId));
  const rulesB = new Set(right.violations.map((rule) => rule.ruleId));
  return {
    leftOnly: [...a].filter((id) => !b.has(id)).sort(),
    rightOnly: [...b].filter((id) => !a.has(id)).sort(),
    shared: [...a].filter((id) => b.has(id)).sort(),
    leftRules: [...rulesA].filter((id) => !rulesB.has(id)).sort(),
    rightRules: [...rulesB].filter((id) => !rulesA.has(id)).sort(),
  };
}
