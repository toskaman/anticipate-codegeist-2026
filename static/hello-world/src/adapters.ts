import {
  actions,
  demoAdapter,
  forgeAdapter,
  initialWorkflow,
  passport,
  scenarioSchema,
  scenarios,
  services,
  transition,
  type ScenarioId,
  type Workflow,
} from "./domain";
export const project = { id: "platform", name: "Platform Engineering" };
export const snapshot = {
  id: "demo-auth-v1-2026-11-02",
  projectId: project.id,
  change: "AUTH-142",
  disclosure: "DEMO DATA — fictional snapshot",
};
export type Plan = {
  scenario: ScenarioId;
  actions: typeof actions;
  workflow: Workflow;
};
export interface ExperienceAdapter {
  getCapabilities(): ReturnType<typeof demoAdapter.getCapabilities>;
  getProjects(): Promise<(typeof project)[]>;
  getProjectSnapshot(projectId: string): Promise<typeof snapshot>;
  getEvidenceGraph(): Promise<typeof services>;
  simulateChange(id: ScenarioId): Promise<(typeof scenarios)[ScenarioId]>;
  compareScenarios(
    ids: ScenarioId[],
  ): Promise<{ id: ScenarioId; result: (typeof scenarios)[ScenarioId] }[]>;
  generatePreventionPlan(id: ScenarioId): Promise<Plan>;
  approvePreventionPlan(plan: Plan): Promise<Plan>;
  executeApprovedPlan(plan: Plan): Promise<Plan>;
  getPreventionPassport(plan: Plan): Promise<ReturnType<typeof passport>>;
}
export const localAdapter: ExperienceAdapter = {
  ...demoAdapter,
  async getProjects() {
    return structuredClone([project]);
  },
  async getProjectSnapshot(id) {
    if (id !== project.id) throw new Error("NOT_FOUND: project");
    return { ...snapshot };
  },
  async compareScenarios(ids) {
    return Promise.all(
      ids.map(async (id) => ({
        id: scenarioSchema.parse(id),
        result: await demoAdapter.simulateChange(id),
      })),
    );
  },
  async generatePreventionPlan(id) {
    return {
      scenario: scenarioSchema.parse(id),
      actions: [...actions],
      workflow: initialWorkflow(),
    };
  },
  async approvePreventionPlan(plan) {
    if (scenarioSchema.parse(plan.scenario) !== "C")
      throw new Error("DEMO_BLOCKED: choose guarded scenario C");
    return { ...plan, workflow: transition(plan.workflow, "approve") };
  },
  async executeApprovedPlan(plan) {
    if (scenarioSchema.parse(plan.scenario) !== "C")
      throw new Error("DEMO_BLOCKED: guarded scenario required");
    return { ...plan, workflow: transition(plan.workflow, "execute") };
  },
  async getPreventionPassport(plan) {
    return passport(scenarioSchema.parse(plan.scenario), plan.workflow);
  },
};
async function unavailable(): Promise<never> {
  throw new Error("PENDING_BACKEND: integration contract unavailable");
}
export const unavailableForgeAdapter: ExperienceAdapter = {
  ...forgeAdapter,
  getProjects: unavailable,
  getProjectSnapshot: unavailable,
  compareScenarios: unavailable,
  generatePreventionPlan: unavailable,
  approvePreventionPlan: unavailable,
  executeApprovedPlan: unavailable,
  getPreventionPassport: unavailable,
};
