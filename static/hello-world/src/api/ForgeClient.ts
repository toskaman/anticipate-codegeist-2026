import {
  capabilitiesSchema,
  planSchema,
  passportSchema,
  executionSchema,
  mutationInputSchema,
  projectSchema,
  ClientError,
  type AnticipateClient,
  type Operation,
} from "./provisional-contracts";
export type Transport = (
  resolver: string,
  input: Record<string, unknown>,
) => Promise<unknown>;
export type Bindings = Partial<Record<Operation, string>>;
// CORE must supply actual resolver identifiers; none are guessed here.
export const coreBindings: Bindings = {};
export class ForgeClient implements AnticipateClient {
  constructor(
    private transport: Transport,
    private bindings: Bindings = coreBindings,
    private timeoutMs = 12000,
  ) {}
  private async call(
    operation: Operation,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const resolver = this.bindings[operation];
    if (!resolver)
      throw new ClientError(
        "UNSUPPORTED",
        `${operation}: awaiting CORE resolver contract`,
      );
    if (signal?.aborted)
      throw new DOMException("Request aborted", "AbortError");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      return await Promise.race([
        this.transport(resolver, input),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new ClientError(
                  "TIMEOUT",
                  "The backend did not respond in time. Check status before retrying a mutation.",
                ),
              ),
            this.timeoutMs,
          );
          onAbort = () =>
            reject(new DOMException("Request aborted", "AbortError"));
          signal?.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
    } catch (error) {
      if (
        error instanceof ClientError ||
        (error instanceof DOMException && error.name === "AbortError")
      )
        throw error;
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "FORBIDDEN" || code === "SNAPSHOT_EXPIRED")
        throw new ClientError(
          code,
          code === "FORBIDDEN"
            ? "Your account is not permitted to perform this operation."
            : "This snapshot expired. Refresh the evidence before approving.",
        );
      throw new ClientError(
        "NETWORK_ERROR",
        "Forge request failed. No success has been assumed.",
      );
    } finally {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
  async getCapabilities(signal?: AbortSignal) {
    if (!this.bindings.getCapabilities)
      return capabilitiesSchema.parse({
        mode: "forge",
        contractVersion: null,
        operations: [],
        integrations: [],
        launchUrl: null,
      });
    const result = capabilitiesSchema.safeParse(
      await this.call("getCapabilities", {}, signal),
    );
    if (!result.success || result.data.mode !== "forge")
      throw new ClientError(
        "INVALID_RESPONSE",
        "Invalid backend capability payload",
      );
    return result.data;
  }
  async getProjects(signal?: AbortSignal) {
    const result = projectSchema
      .array()
      .safeParse(await this.call("getProjects", {}, signal));
    if (!result.success)
      throw new ClientError("INVALID_RESPONSE", "Invalid project payload");
    return result.data;
  }
  async request(
    operation: Exclude<Operation, "getCapabilities" | "getProjects">,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    if (
      operation === "approvePreventionPlan" ||
      operation === "executeApprovedPlan"
    ) {
      const validation = mutationInputSchema.safeParse(input);
      if (!validation.success)
        throw new ClientError(
          "INVALID_RESPONSE",
          "Plan version and explicit action selection are required",
        );
      if (
        operation === "executeApprovedPlan" &&
        (typeof input.idempotencyKey !== "string" || !input.idempotencyKey)
      )
        throw new ClientError(
          "INVALID_RESPONSE",
          "An execution idempotency key is required",
        );
    }
    const payload = await this.call(operation, input, signal);
    const schema =
      operation === "generatePreventionPlan" ||
      operation === "approvePreventionPlan"
        ? planSchema
        : operation === "executeApprovedPlan" ||
            operation === "getExecutionStatus"
          ? executionSchema
          : operation === "getPreventionPassport"
            ? passportSchema
            : null;
    if (schema) {
      const validated = schema.safeParse(payload);
      if (!validated.success)
        throw new ClientError(
          "INVALID_RESPONSE",
          "Invalid plan or execution response",
        );
      if ("mode" in validated.data && validated.data.mode !== "forge")
        throw new ClientError(
          "INVALID_RESPONSE",
          "Fixture plan returned by Forge backend",
        );
      return validated.data;
    }
    return payload;
  }
}
