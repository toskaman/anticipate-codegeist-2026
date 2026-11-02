import type { IconName } from "../components/Icon";
import type { Workflow } from "./useCoreWorkflow";

export type StageState = "done" | "attention" | "available" | "locked";

export interface Stage {
  page: string;
  step: number | null;
  short: string;
  icon: IconName;
  question: string;
}

export const stages: Stage[] = [
  {
    page: "Mission Control",
    step: 1,
    short: "Choose a change",
    icon: "target",
    question: "The question",
  },
  {
    page: "Evidence Graph",
    step: 2,
    short: "Understand dependencies",
    icon: "graph",
    question: "The evidence",
  },
  {
    page: "Scenario Lab",
    step: 3,
    short: "Compare options",
    icon: "scenarios",
    question: "The alternatives",
  },
  {
    page: "Decision Firewall",
    step: 4,
    short: "Check safeguards",
    icon: "shield",
    question: "The decision",
  },
  {
    page: "Prevention Plan",
    step: 5,
    short: "Approve & execute",
    icon: "plan",
    question: "Human control",
  },
  {
    page: "Prevention Passport",
    step: 6,
    short: "Verify & record",
    icon: "passport",
    question: "The proof",
  },
  {
    page: "Settings",
    step: null,
    short: "Connections",
    icon: "settings",
    question: "Transparency",
  },
];

export const stageFor = (page: string) =>
  stages.find((s) => s.page === page) ?? stages[0];

/**
 * Stage state is derived only from backend artefacts held in the workflow
 * (snapshot, comparison, plan, records, passport) — never from page visits.
 */
export function stageState(w: Workflow, page: string): StageState {
  switch (page) {
    case "Mission Control":
      return w.snapshot ? "done" : "available";
    case "Evidence Graph":
      return !w.snapshot ? "locked" : w.comparison ? "done" : "available";
    case "Scenario Lab":
      return !w.snapshot && !w.comparison
        ? "locked"
        : w.comparison
          ? "done"
          : "available";
    case "Decision Firewall":
      return !w.currentResult ? "locked" : w.plan ? "done" : "available";
    case "Prevention Plan": {
      if (!w.plan) return "locked";
      if (w.plan.status === "COMPLETED") return "done";
      if (
        w.plan.status === "PARTIAL" ||
        w.plan.status === "FAILED" ||
        (w.attempted && !w.records?.length)
      )
        return "attention";
      return "available";
    }
    case "Prevention Passport":
      return !w.plan ? "locked" : w.passport ? "done" : "available";
    default:
      return "available";
  }
}

export const stageStateText: Record<StageState, string> = {
  done: "Completed",
  attention: "Needs attention",
  available: "Available",
  locked: "Not available yet",
};
