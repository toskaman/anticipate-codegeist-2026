import {
  ClientError,
  planSchema,
  passportSchema,
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
    return {
      mode: "fixture" as const,
      contractVersion: "frontend-proposal-v2",
      operations: [
        "getCapabilities",
        "getProjects",
        "generatePreventionPlan",
        "getPreventionPassport",
      ] as Operation[],
      integrations: [],
      launchUrl: null,
    };
  }
  async getProjects() {
    this.check();
    return [
      { id: "platform", name: "Platform Engineering — fictional fixture" },
    ];
  }
  async request(
    operation: Exclude<Operation, "getCapabilities" | "getProjects">,
    input: Record<string, unknown>,
  ) {
    this.check();
    if (input.snapshotId && input.snapshotId !== "demo-auth-v1-2026-11-02")
      throw new ClientError(
        "SNAPSHOT_EXPIRED",
        "Fixture snapshot does not match the active evidence",
      );
    if (operation === "getPreventionPassport") {
      const { passport, initialWorkflow, scenarioSchema } =
        await import("../domain");
      const scenario = scenarioSchema.parse(input.scenarioId);
      return passportSchema.parse({
        ...passport(scenario, initialWorkflow()),
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
