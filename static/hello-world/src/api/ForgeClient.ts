import {
  CONTRACT_VERSION,
  OPERATIONS,
  envelope,
  type OperationName,
  type ErrorCode,
} from "@anticipate/contracts";
import { recordRequest, startTimer } from "../app/perf";

export type CoreInput<K extends OperationName> =
  (typeof OPERATIONS)[K]["input"]["_input"];
export type CoreData<K extends OperationName> = ReturnType<
  (typeof OPERATIONS)[K]["output"]["parse"]
>;
export type Transport = (
  resolver: OperationName,
  input: Record<string, unknown>,
) => Promise<unknown>;
export class CoreClientError extends Error {
  constructor(
    public code: ErrorCode | "INVALID_RESPONSE" | "NETWORK_ERROR",
    message: string,
    public requestId: string | null = null,
    public retryable = false,
    public details?: Record<string, unknown>,
  ) {
    super(`${code}: ${message}${requestId ? ` (request ${requestId})` : ""}`);
    this.name = "CoreClientError";
  }
}
const invalid = (message: string): never => {
  throw new CoreClientError("INVALID_RESPONSE", message);
};

// Bound work before invoking recursive validators. Bridge has already decoded the
// message; this limits validator amplification, not upstream transport allocation.
function checkResponseBudget(raw: unknown) {
  const queue: { value: unknown; depth: number }[] = [{ value: raw, depth: 0 }];
  let values = 1;
  let characters = 0;
  const push = (value: unknown, depth: number) => {
    if (++values > 100000)
      return invalid("Response exceeds the validation value budget.");
    queue.push({ value, depth });
  };
  while (queue.length) {
    const { value, depth } = queue.pop()!;
    if (depth > 64)
      return invalid("Response nesting exceeds the validation budget.");
    if (typeof value === "string") {
      characters += value.length;
      if (characters > 4 * 1024 * 1024)
        return invalid("Response text exceeds the validation budget.");
    } else if (Array.isArray(value)) {
      if (value.length > 20000)
        return invalid("Response collection exceeds the validation budget.");
      for (const item of value) push(item, depth + 1);
    } else if (value && typeof value === "object") {
      let fields = 0;
      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (++fields > 1000)
          return invalid(
            "Response object exceeds the validation field budget.",
          );
        push((value as Record<string, unknown>)[key], depth + 1);
      }
    }
  }
}

/** Exact CORE 0.2.0 resolver keys, runtime envelopes and LIVE-only responses. No fixture fallback. */
export class ForgeClient {
  constructor(
    private transport: Transport,
    private timeoutMs?: number,
  ) {}
  async request<K extends OperationName>(
    operation: K,
    input: CoreInput<K>,
    signal?: AbortSignal,
  ): Promise<CoreData<K>> {
    const parsed = OPERATIONS[operation].input.safeParse(input);
    if (!parsed.success)
      throw new CoreClientError(
        "VALIDATION",
        "Check the required operation inputs.",
      );
    if (signal?.aborted)
      throw new DOMException("Request aborted", "AbortError");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const elapsed = startTimer();
    let ok = false;
    try {
      const raw = await Promise.race([
        this.transport(operation, parsed.data),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CoreClientError(
                  "TIMEOUT",
                  operation === "createSampleProject"
                    ? "Response not received. Sample creation may still be running. Preview sample data in the selected Jira project before any further creation. No result is assumed."
                    : operation === "previewSampleProject"
                      ? "Sample preview response not received. No Jira creation was requested."
                      : operation === "simulatePortfolio"
                        ? "Read-only portfolio simulation timed out. No Jira change was requested. Retry explicitly or read fresh evidence."
                        : operation === "getPlanAttention"
                          ? "Radar read timed out. No monitoring or freshness state is assumed. Retry explicitly."
                          : operation === "checkPlanFreshness"
                            ? "Evidence freshness response not received. No freshness is assumed."
                            : "Response not received. Recover execution status by planId before another write.",
                ),
              ),
            this.timeoutMs ??
              (operation === "createSampleProject" ? 60000 : 12000),
          );
          onAbort = () =>
            reject(new DOMException("Request aborted", "AbortError"));
          signal?.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
      checkResponseBudget(raw);
      const response = envelope(OPERATIONS[operation].output).safeParse(raw);
      if (!response.success)
        return invalid(
          "Backend envelope or payload does not match CORE 0.2.0.",
        );
      const result = response.data;
      if (
        result.meta.contractVersion !== CONTRACT_VERSION ||
        result.meta.mode !== "LIVE"
      )
        return invalid(
          "Unexpected contract version or demo response in LIVE mode.",
        );
      if (!result.ok) {
        if (result.error.requestId !== result.meta.requestId)
          return invalid("Error correlation mismatch.");
        throw new CoreClientError(
          result.error.code,
          result.error.message,
          result.error.requestId,
          result.error.retryable,
          result.error.details,
        );
      }
      // Runtime schema validation precedes this generic type assertion.
      const data = result.data as CoreData<K>;
      const obj = data as Record<string, unknown>;
      const args = parsed.data as Record<string, unknown>;
      if (obj && !Array.isArray(obj)) {
        if ("mode" in obj && obj.mode !== "LIVE")
          return invalid("Demo payload returned by LIVE backend.");
        if (args.snapshotId && obj.snapshotId !== args.snapshotId)
          return invalid("Snapshot mismatch.");
        if (args.scenarioId && obj.scenarioId !== args.scenarioId)
          return invalid("Scenario mismatch.");
        if (
          args.planId &&
          operation !== "getPreventionPassport" &&
          obj.planId !== args.planId
        )
          return invalid("Plan mismatch.");
        if (operation === "approvePlan" && obj.planHash !== args.planHash)
          return invalid("Approval changed the reviewed plan hash.");
        if (args.projectKey && obj.projectKey !== args.projectKey)
          return invalid("Sample data belongs to another project.");
      }
      if (
        operation === "getGraphSnapshot" ||
        operation === "getEvidenceGraph"
      ) {
        const graph = data as CoreData<"getEvidenceGraph">;
        const ids = new Set(graph.nodes.map((n) => n.id));
        if (
          ids.size !== graph.nodes.length ||
          new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length ||
          graph.edges.some((e) => !ids.has(e.from) || !ids.has(e.to)) ||
          [...graph.nodes, ...graph.edges].some((n) =>
            n.references.some((r) => r.sourceSystem === "FIXTURE"),
          )
        )
          return invalid(
            "Invalid graph identity, endpoints or fixture provenance.",
          );
        if (
          operation === "getGraphSnapshot" &&
          graph.projectId !== args.projectId
        )
          return invalid("Project mismatch.");
      }
      if (operation === "compareScenarios" || operation === "simulateChange") {
        const results =
          operation === "compareScenarios"
            ? (data as CoreData<"compareScenarios">).results
            : (data as CoreData<"simulateChange">);
        const expected = new Set(
          (parsed.data as CoreInput<"compareScenarios">).scenarios.map(
            (s) => s.scenarioId,
          ),
        );
        if (
          results.length !== expected.size ||
          new Set(results.map((r) => r.scenarioId)).size !== expected.size ||
          results.some(
            (r) =>
              r.snapshotId !== args.snapshotId ||
              !expected.has(r.scenarioId) ||
              !r.resultHash,
          )
        )
          return invalid("Incomplete or mismatched simulation results.");
      }
      if (
        operation === "getExecutionStatus" ||
        operation === "executeApprovedPlan"
      ) {
        const records = data as CoreData<"getExecutionStatus">;
        if (
          records.some((r) => r.planId !== args.planId) ||
          new Set(records.map((r) => r.actionId)).size !== records.length
        )
          return invalid(
            "Execution records belong to another plan or contain duplicate actions.",
          );
      }
      if (operation === "getPreventionPassport") {
        const passport = data as CoreData<"getPreventionPassport">;
        if (
          !passport.plan ||
          passport.plan.planId !== args.planId ||
          passport.plan.snapshotId !== passport.snapshotId ||
          passport.comparison.snapshotId !== passport.snapshotId ||
          passport.executions.some((r) => r.planId !== args.planId) ||
          !passport.comparison.results.some(
            (r) => r.scenarioId === passport.plan?.scenarioId,
          )
        )
          return invalid("Passport does not match its plan and snapshot.");
      }
      ok = true;
      return data;
    } catch (error) {
      if (
        error instanceof CoreClientError ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        throw error;
      throw new CoreClientError(
        "NETWORK_ERROR",
        "Forge Bridge is unavailable or the request failed. No success is assumed.",
      );
    } finally {
      recordRequest(operation, elapsed(), ok);
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
}
