// Frontend requirements for CORE review, NOT published backend resolver bindings.
// Keep runtime validation at the transport boundary; types alone do not authorize writes.
import type { z } from "zod";
import type {
  capabilitiesSchema,
  projectSchema,
  snapshotSchema,
  graphSchema,
  simulationSchema,
  comparisonsSchema,
  planSchema,
  executionSchema,
  passportSchema,
  mutationInputSchema,
} from "./provisional-contracts";

export type ScenarioId = "A" | "B" | "C";
export type ProjectSnapshot = z.infer<typeof snapshotSchema>;
export type EvidenceGraphPayload = z.infer<typeof graphSchema>;
export type SimulationResult = z.infer<typeof simulationSchema>;
export type ScenarioComparison = z.infer<typeof comparisonsSchema>;
export type PreventionPassport = z.infer<typeof passportSchema>;
export type PlanSelection = z.infer<typeof mutationInputSchema>;
export type SnapshotInput = { snapshotId: string };

// Inputs currently consumed by the frontend. Plan generation currently supports
// only authored C; scenario-bound plan generation is a release integration gate.
export interface CoreOperationInputs {
  getCapabilities: Record<string, never>;
  getProjects: Record<string, never>;
  getProjectSnapshot: { projectId: string };
  getEvidenceGraph: SnapshotInput;
  simulateChange: SnapshotInput & { scenarioId: ScenarioId };
  compareScenarios: SnapshotInput;
  generatePreventionPlan: SnapshotInput;
  approvePreventionPlan: PlanSelection;
  executeApprovedPlan: PlanSelection & { idempotencyKey: string };
  getExecutionStatus:
    | { executionId: string; idempotencyKey?: never }
    | { idempotencyKey: string; executionId?: never };
  getPreventionPassport: SnapshotInput & { scenarioId: ScenarioId };
}
export interface CoreOperationOutputs {
  getCapabilities: z.infer<typeof capabilitiesSchema>;
  getProjects: z.infer<typeof projectSchema>[];
  getProjectSnapshot: ProjectSnapshot;
  getEvidenceGraph: EvidenceGraphPayload;
  simulateChange: SimulationResult;
  compareScenarios: ScenarioComparison;
  generatePreventionPlan: z.infer<typeof planSchema>;
  approvePreventionPlan: z.infer<typeof planSchema>;
  executeApprovedPlan: z.infer<typeof executionSchema>;
  getExecutionStatus: z.infer<typeof executionSchema>;
  getPreventionPassport: PreventionPassport;
}
