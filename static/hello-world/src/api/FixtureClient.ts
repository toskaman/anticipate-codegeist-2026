import {
  ClientError,
  capabilitiesSchema,
  projectSchema,
  planSchema,
  passportSchema,
  snapshotSchema,
  graphSchema,
  simulationSchema,
  comparisonsSchema,
  type AnticipateClient,
  type Operation,
} from "./provisional-contracts";
export class FixtureClient implements AnticipateClient {
  private check() {
    if (!import.meta.env.DEV && import.meta.env.MODE !== "test")
      throw new ClientError(
        "UNSUPPORTED",
        "Fixtures are restricted to development and test",
      );
  }
  async getCapabilities() {
    this.check();
    return capabilitiesSchema.parse({
      mode: "fixture",
      contractVersion: "frontend-proposal-v2",
      operations: [
        "getCapabilities",
        "getProjects",
        "getProjectSnapshot",
        "getEvidenceGraph",
        "simulateChange",
        "compareScenarios",
        "generatePreventionPlan",
        "getPreventionPassport",
      ],
      integrations: [],
      launchUrl: null,
    });
  }
  async getProjects() {
    this.check();
    return projectSchema
      .array()
      .parse([
        { id: "platform", name: "Platform Engineering — fictional fixture" },
      ]);
  }
  async request(
    operation: Exclude<Operation, "getCapabilities" | "getProjects">,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    this.check();
    if (signal?.aborted)
      throw new DOMException("Request aborted", "AbortError");
    if (input.snapshotId && input.snapshotId !== "demo-auth-v1-2026-11-02")
      throw new ClientError(
        "SNAPSHOT_EXPIRED",
        "Fixture snapshot does not match the active evidence",
      );
    const snapshotId = "demo-auth-v1-2026-11-02";
    if (operation === "getProjectSnapshot") {
      if (input.projectId !== "platform")
        throw new ClientError("UNAVAILABLE", "Project snapshot not found");
      return snapshotSchema.parse({
        mode: "fixture",
        id: snapshotId,
        projectId: "platform",
        change: "AUTH-142",
        capturedAt: "2026-11-02T00:00:00Z",
        disclosure: "DEMO DATA — fictional snapshot",
      });
    }
    if (operation === "getEvidenceGraph") {
      const { services } = await import("../domain");
      return graphSchema.parse({
        mode: "fixture",
        snapshotId,
        services: structuredClone(services),
      });
    }
    if (operation === "simulateChange") {
      const { scenarios, scenarioSchema } = await import("../domain");
      const scenario = scenarioSchema.parse(input.scenarioId);
      return simulationSchema.parse({
        snapshotId,
        scenarioId: scenario,
        result: structuredClone(scenarios[scenario]),
        source: "authored-fixture",
      });
    }
    if (operation === "compareScenarios") {
      const { scenarios } = await import("../domain");
      return comparisonsSchema.parse({
        snapshotId,
        source: "authored-fixture",
        results: Object.entries(scenarios).map(([id, result]) => ({
          id,
          result: structuredClone(result),
        })),
      });
    }
    if (operation === "getPreventionPassport") {
      const { fixturePassport, scenarioSchema } = await import("../domain");
      const scenario = scenarioSchema.parse(input.scenarioId);
      return passportSchema.parse({
        ...fixturePassport(scenario),
        mode: "fixture",
        execution: "Requires live authenticated backend",
        approvalTimeline: [],
      });
    }
    if (operation === "generatePreventionPlan") {
      const { actionDetails, services } = await import("../domain");
      return planSchema.parse({
        planId: "fixture-plan-C",
        version: 1,
        snapshotId: "demo-auth-v1-2026-11-02",
        mode: "fixture",
        actions: actionDetails.map((action, index) => ({
          actionId: `fixture-action-${index + 1}`,
          title: action.title,
          target: action.target,
          reason: action.reason,
          evidence: action.evidenceIds.map((id) => ({
            reference: services.find((service) => service.id === id)!.source,
            url: null,
          })),
          requiredPermission: "Owner review and backend-authorized Jira action",
          verificationRule: action.outcome,
          approval: "REQUIRED",
        })),
      });
    }
    if (
      [
        "approvePreventionPlan",
        "executeApprovedPlan",
        "getExecutionStatus",
      ].includes(operation)
    )
      throw new ClientError(
        "REQUIRES_LIVE_BACKEND",
        "Requires live authenticated backend. No Jira action was performed.",
      );
    throw new ClientError(
      "UNSUPPORTED",
      "Fixture payload mapping is awaiting the reviewed CORE schema",
    );
  }
}
