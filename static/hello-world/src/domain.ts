import { z } from "zod";

export const scenarioSchema = z.enum(["A", "B", "C"]);
export type ScenarioId = z.infer<typeof scenarioSchema>;
export type Evidence = "CONFIRMED" | "INFERRED" | "UNKNOWN";
export const services: {
  id: string;
  label: string;
  evidence: Evidence;
  source: string;
  detail: string;
}[] = [
  {
    id: "checkout",
    label: "Checkout Service",
    evidence: "CONFIRMED",
    source: "Fixture E-01 · checkout-client.ts:42",
    detail:
      "Checkout still calls /auth/v1/token. Migrate and run contract tests before removal.",
  },
  {
    id: "mobile",
    label: "Mobile Application",
    evidence: "CONFIRMED",
    source: "Fixture E-02 · mobile release inventory",
    detail:
      "Version 4.8 uses the legacy token response. Require minimum supported client adoption.",
  },
  {
    id: "support",
    label: "Customer Support Integration",
    evidence: "UNKNOWN",
    source: "Fixture E-03 · owner interview pending",
    detail:
      "No current consumer inventory. Confirm ownership and API usage; absence of evidence is not proof of safety.",
  },
  {
    id: "gateway",
    label: "Authentication Gateway",
    evidence: "CONFIRMED",
    source: "Fixture E-04 · gateway routing snapshot",
    detail:
      "Gateway routes v1 and v2. Preserve rollback routing during migration.",
  },
  {
    id: "pipeline",
    label: "Release Pipeline",
    evidence: "INFERRED",
    source: "Fixture E-05 · pipeline configuration excerpt",
    detail:
      "Smoke-test naming suggests v1 coverage. Verify with the pipeline owner.",
  },
];
export const scenarios = {
  A: {
    name: "Remove immediately",
    risk: "Critical",
    violations: 3,
    blockers: [
      "Checkout still calls v1",
      "Mobile clients require v1",
      "Support usage unknown",
    ],
    summary: "Removal breaks confirmed consumers. Do not proceed.",
    mitigations: [
      "Migrate checkout and mobile",
      "Confirm support ownership",
      "Establish rollback",
    ],
  },
  B: {
    name: "Retain & migrate",
    risk: "Elevated",
    violations: 1,
    blockers: ["Support usage unknown", "Retirement date not agreed"],
    summary:
      "Retain compatibility while consumers migrate; retirement remains unresolved.",
    mitigations: ["Agree retirement criteria", "Inventory support integration"],
  },
  C: {
    name: "Gradual, guarded rollout",
    risk: "Conditional",
    violations: 0,
    blockers: ["Support usage unknown", "Owner approval required"],
    summary:
      "Best supported alternative. Proceed only after evidence and approvals are resolved.",
    mitigations: [
      "Verify support usage",
      "Run contract tests",
      "Require owner approval",
      "Keep rollback available",
    ],
  },
} as const;
export const actions = [
  "Verify support consumer inventory",
  "Migrate checkout and mobile to v2",
  "Run gateway and pipeline contract tests",
  "Approve staged rollout and rollback",
];
export type Workflow = {
  approved: boolean;
  executed: boolean;
  timeline: { event: string; at: string }[];
};
export const initialWorkflow = (): Workflow => ({
  approved: false,
  executed: false,
  timeline: [],
});
export function transition(
  state: Workflow,
  event: "approve" | "execute",
  at = new Date().toISOString(),
): Workflow {
  if (event === "execute" && !state.approved)
    throw new Error("Local approval is required.");
  if (
    (event === "approve" && state.approved) ||
    (event === "execute" && state.executed)
  )
    return state;
  return {
    approved: true,
    executed: event === "execute" || state.executed,
    timeline: [
      ...state.timeline,
      {
        event:
          event === "approve"
            ? "Local demo approval"
            : "Simulated execution complete",
        at,
      },
    ],
  };
}
export interface DataAdapter {
  getCapabilities(): Promise<{ mode: "demo" | "forge"; execution: boolean }>;
  getEvidenceGraph(): Promise<typeof services>;
  simulateChange(id: ScenarioId): Promise<(typeof scenarios)[ScenarioId]>;
}
export const demoAdapter: DataAdapter = {
  async getCapabilities() {
    return { mode: "demo", execution: false };
  },
  async getEvidenceGraph() {
    return structuredClone(services);
  },
  async simulateChange(id) {
    return structuredClone(scenarios[scenarioSchema.parse(id)]);
  },
};
export const forgeAdapter: DataAdapter = {
  async getCapabilities() {
    return { mode: "forge", execution: false };
  },
  async getEvidenceGraph() {
    throw new Error("PENDING_BACKEND: evidence contract unavailable");
  },
  async simulateChange() {
    throw new Error("PENDING_BACKEND: simulation contract unavailable");
  },
};
export function passport(id: ScenarioId, workflow: Workflow) {
  return {
    disclosure: "DEMO DATA — fictional local simulation. No Jira changes made.",
    change: "AUTH-142",
    snapshot: "demo-auth-v1-2026-11-02",
    createdAt: new Date().toISOString(),
    selectedScenario: id,
    comparedScenarios: scenarios,
    affectedDependencies: services,
    mitigations: scenarios[id].mitigations,
    violatedPolicies: scenarios[id].violations,
    uncertainty: scenarios[id].blockers,
    approvalTimeline: workflow.timeline,
    execution: workflow.executed ? "Simulated complete" : "Not executed",
  };
}

export const actionDetails = [
  {
    title: actions[0],
    description:
      "Identify the support integration owner and record current legacy API usage.",
    reason:
      "Support dependency is UNKNOWN; removal must not assume it is unused.",
    target: "Support consumer inventory",
    priority: "Critical",
    evidenceIds: ["support"],
    outcome: "Owner-confirmed usage inventory and migration decision",
  },
  {
    title: actions[1],
    description:
      "Move checkout calls to v2 and set minimum supported mobile client criteria.",
    reason: "Both consumers have confirmed v1 dependencies.",
    target: "Checkout Service and Mobile Application",
    priority: "High",
    evidenceIds: ["checkout", "mobile"],
    outcome: "Consumer contract tests pass against v2",
  },
  {
    title: actions[2],
    description:
      "Exercise both gateway routes and confirm release smoke-test API coverage.",
    reason:
      "Gateway rollback must remain available and pipeline coverage is inferred.",
    target: "Authentication Gateway and Release Pipeline",
    priority: "High",
    evidenceIds: ["gateway", "pipeline"],
    outcome: "Documented contract-test results and verified pipeline coverage",
  },
  {
    title: actions[3],
    description:
      "Review staged rollout criteria, owner approvals and rollback thresholds.",
    reason:
      "A guarded alternative still requires explicit review and unresolved evidence.",
    target: "Local demo approval workflow",
    priority: "High",
    evidenceIds: ["support", "gateway"],
    outcome:
      "Local decision recorded; real release authorization remains pending backend",
  },
];
