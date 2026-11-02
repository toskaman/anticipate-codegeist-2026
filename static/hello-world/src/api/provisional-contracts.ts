// Historical authored-prototype schemas for DEV/test only. Production uses @anticipate/contracts.
import { z } from "zod";
export const errorCodes = [
  "UNAVAILABLE",
  "FORBIDDEN",
  "SNAPSHOT_EXPIRED",
  "NETWORK_ERROR",
  "UNSUPPORTED",
  "INVALID_RESPONSE",
  "TIMEOUT",
  "REQUIRES_LIVE_BACKEND",
] as const;
export type ErrorCode = (typeof errorCodes)[number];
export class ClientError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClientError";
  }
}
export const operations = [
  "getCapabilities",
  "getProjects",
  "getProjectSnapshot",
  "getEvidenceGraph",
  "simulateChange",
  "compareScenarios",
  "generatePreventionPlan",
  "approvePreventionPlan",
  "executeApprovedPlan",
  "getExecutionStatus",
  "getPreventionPassport",
] as const;
export type Operation = (typeof operations)[number];
export const capabilitiesSchema = z.object({
  mode: z.enum(["fixture", "forge"]),
  contractVersion: z.string().nullable(),
  operations: z.array(z.enum(operations)),
  integrations: z.array(z.string()),
  launchUrl: z.string().url().nullable(),
});
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export const executionSchema = z.object({
  executionId: z.string(),
  planId: z.string(),
  status: z.enum(["PENDING", "RUNNING", "PARTIAL", "FAILED", "SUCCEEDED"]),
  actions: z.array(
    z.object({
      actionId: z.string(),
      status: z.enum(["PENDING", "RUNNING", "FAILED", "VERIFIED"]),
      attempt: z.number().int().nonnegative(),
      jiraIssueUrl: z.string().url().nullable(),
      error: z.string().nullable(),
    }),
  ),
});
// All operations use explicit inputs and return unknown until a real payload schema is agreed.
// Never coerce unknown CORE data into fixture-shaped success.
export interface AnticipateClient {
  getCapabilities(signal?: AbortSignal): Promise<Capabilities>;
  getProjects(signal?: AbortSignal): Promise<z.infer<typeof projectSchema>[]>;
  request(
    operation: Exclude<Operation, "getCapabilities" | "getProjects">,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export const safeSourceUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Only HTTPS evidence URLs are allowed",
  );
export const actionSchema = z.object({
  actionId: z.string().min(1),
  title: z.string().min(1),
  target: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.array(
    z.object({ reference: z.string(), url: safeSourceUrlSchema.nullable() }),
  ),
  requiredPermission: z.string().min(1),
  verificationRule: z.string().min(1),
  approval: z.enum(["REQUIRED", "APPROVED", "DENIED"]),
});
export const planSchema = z.object({
  planId: z.string().min(1),
  version: z.number().int().positive(),
  snapshotId: z.string().min(1),
  mode: z.enum(["fixture", "forge"]),
  actions: z.array(actionSchema),
});
export type ReviewPlan = z.infer<typeof planSchema>;
export type Execution = z.infer<typeof executionSchema>;
export const mutationInputSchema = z.object({
  planId: z.string().min(1),
  version: z.number().int().positive(),
  actionIds: z.array(z.string().min(1)).min(1),
});

export const passportSchema = z.object({
  mode: z.enum(["fixture", "forge"]),
  disclosure: z.string().min(1),
  change: z.string().min(1),
  snapshot: z.string().min(1),
  createdAt: z.string().datetime(),
  selectedScenario: z.enum(["A", "B", "C"]),
  comparedScenarios: z.unknown(),
  affectedDependencies: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      evidence: z.enum(["CONFIRMED", "INFERRED", "UNKNOWN"]),
      source: z.string(),
      detail: z.string(),
    }),
  ),
  mitigations: z.array(z.string()),
  violatedPolicies: z.number().int().nonnegative(),
  uncertainty: z.array(z.string()),
  approvalTimeline: z.array(
    z.object({ event: z.string(), at: z.string().datetime() }),
  ),
  execution: z.string(),
});

// TEMPORARY read payloads shared by both client implementations.
export const snapshotSchema = z.object({
  mode: z.enum(["fixture", "forge"]),
  id: z.string().min(1),
  projectId: z.string().min(1),
  change: z.string().min(1),
  capturedAt: z.string().datetime(),
  disclosure: z.string(),
});
export const dependencySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  evidence: z.enum(["CONFIRMED", "INFERRED", "UNKNOWN"]),
  source: z.string().min(1),
  detail: z.string().min(1),
});
export const relationshipSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  relation: z.enum(["CALLS", "ROUTES", "TESTS", "DEPENDS_ON"]),
  evidence: z.enum(["CONFIRMED", "INFERRED", "UNKNOWN"]),
  sourceReference: z.string().min(1),
  sourceUrl: safeSourceUrlSchema.nullable(),
  observedAt: z.string().datetime().nullable(),
  freshness: z.enum(["FRESH", "STALE", "UNKNOWN"]),
  impact: z.enum(["DIRECT", "TRANSITIVE"]),
  provenance: z.array(z.string()).min(1),
});

export const graphSchema = z
  .object({
    mode: z.enum(["fixture", "forge"]),
    snapshotId: z.string().min(1),
    root: z.object({ id: z.string().min(1), label: z.string().min(1) }),
    services: z.array(dependencySchema).max(10000),
    edges: z.array(relationshipSchema).max(30000),
  })
  .refine(
    (graph) =>
      new Set(graph.services.map((service) => service.id)).size ===
      graph.services.length,
    "Duplicate evidence node IDs",
  )
  .refine((graph) => {
    const ids = new Set([
      graph.root.id,
      ...graph.services.map((service) => service.id),
    ]);
    return (
      !graph.services.some((service) => service.id === graph.root.id) &&
      new Set(graph.edges.map((edge) => edge.id)).size === graph.edges.length &&
      graph.edges.every(
        (edge) =>
          ids.has(edge.source) &&
          ids.has(edge.target) &&
          edge.provenance.every((id) => ids.has(id)),
      )
    );
  }, "Invalid or duplicate relationship endpoints")
  .refine((graph) => {
    const pairs = new Set(
      graph.edges.map((edge) => JSON.stringify([edge.source, edge.target])),
    );
    return graph.edges.every(
      (edge) =>
        edge.provenance.length >= 2 &&
        edge.provenance[0] === edge.source &&
        edge.provenance[1] === edge.target &&
        edge.provenance
          .slice(1)
          .every((id, index) =>
            pairs.has(JSON.stringify([edge.provenance[index], id])),
          ),
    );
  }, "Provenance must follow supplied relationships");
export const scenarioResultSchema = z.object({
  name: z.string().min(1),
  risk: z.string().min(1),
  violations: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
  summary: z.string(),
  mitigations: z.array(z.string()),
});
export const simulationSchema = z.object({
  snapshotId: z.string().min(1),
  scenarioId: z.enum(["A", "B", "C"]),
  result: scenarioResultSchema,
  source: z.enum(["authored-fixture", "simulator"]),
});
export const comparisonsSchema = z
  .object({
    snapshotId: z.string().min(1),
    source: z.enum(["authored-fixture", "simulator"]),
    results: z.array(
      z.object({ id: z.enum(["A", "B", "C"]), result: scenarioResultSchema }),
    ),
  })
  .refine(
    (comparison) =>
      comparison.results.length === 3 &&
      new Set(comparison.results.map((result) => result.id)).size === 3,
    "Complete A/B/C comparison required",
  );
