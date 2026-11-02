// Authoritative CORE 0.2.0 schemas and types. No copied proposal or guessed resolver map.
export {
  CONTRACT_VERSION,
  OPERATIONS,
  type CapabilityAvailability,
  type ProjectSummary,
  type JiraIssueSummary,
  type GraphSnapshot,
  type ScenarioDefinition,
  type SimulationRequest,
  type SimulationResult,
  type ScenarioComparison,
  type PreventionPlan,
  type ApprovalRequest,
  type ExecutionRecord,
  type PreventionPassport,
  type ApiError,
  type EvidenceDrift,
  type SampleProjectPlan,
  type OperationName,
} from "@anticipate/contracts";
import type { OperationName } from "@anticipate/contracts";
import type { CoreInput, CoreData } from "./ForgeClient";
export type CoreOperationInputs = { [K in OperationName]: CoreInput<K> };
export type CoreOperationOutputs = { [K in OperationName]: CoreData<K> };
