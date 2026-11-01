// TEMPORARY frontend proposal. Replace with packages/contracts after CORE review.
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
