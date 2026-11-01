import {
  ClientError,
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
      operations: ["getCapabilities", "getProjects"] as Operation[],
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
    _input: Record<string, unknown>,
  ) {
    this.check();
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
