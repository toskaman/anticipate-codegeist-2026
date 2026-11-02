import React from "react";
import type {
  CapabilityAvailability,
  GraphSnapshot,
} from "@anticipate/contracts";
import { Badge } from "./ui";

type Tone = "success" | "warning" | "neutral" | "danger";
type Row = { name: string; tone: Tone; label: string; detail: string };

const coverageState: Record<string, { tone: Tone; label: string }> = {
  FULL: { tone: "success", label: "Included" },
  PARTIAL: { tone: "warning", label: "Partial coverage" },
  UNAVAILABLE: { tone: "danger", label: "Unavailable" },
  NOT_CONFIGURED: { tone: "neutral", label: "Not configured" },
};
const capabilityState: Record<string, { tone: Tone; label: string }> = {
  NOT_CONFIGURED: { tone: "neutral", label: "Not configured" },
  PERMISSION_REQUIRED: { tone: "warning", label: "Permission required" },
  UNSUPPORTED: { tone: "neutral", label: "Unavailable" },
  DISABLED_BY_BUDGET: { tone: "neutral", label: "Unavailable" },
  AVAILABLE: { tone: "neutral", label: "Not used in this analysis" },
};

/**
 * Which evidence sources this snapshot actually used. Only backend-reported
 * coverage counts; a source is never shown as connected because it is
 * declared. Absent coverage means the snapshot is Jira only (contract).
 */
export function coverageRows(
  graph: Pick<GraphSnapshot, "coverage">,
  teamworkGraph: CapabilityAvailability["teamworkGraph"] | undefined,
): Row[] {
  const reported = graph.coverage ?? [];
  const jira = reported.find((c) => c.source === "JIRA");
  const twg = reported.find((c) => c.source === "TEAMWORK_GRAPH");
  const rows: Row[] = [
    jira
      ? { name: "Jira", ...coverageState[jira.state], detail: jira.detail }
      : {
          name: "Jira",
          tone: "success",
          label: "Included",
          detail: "Issues and issue links you can read.",
        },
  ];
  if (twg)
    rows.push({
      name: "Teamwork Graph",
      ...coverageState[twg.state],
      detail: twg.detail,
    });
  else {
    const s = capabilityState[teamworkGraph ?? "NOT_CONFIGURED"];
    rows.push({
      name: "Teamwork Graph",
      ...s,
      detail:
        teamworkGraph === "PERMISSION_REQUIRED"
          ? "An administrator must grant access before it can add evidence."
          : teamworkGraph === "AVAILABLE"
            ? "Reported available, but this analysis did not include it."
            : "Not part of this analysis; results use Jira evidence only.",
    });
  }
  return rows;
}

export default function EvidenceCoverage({
  graph,
  teamworkGraph,
}: {
  graph: Pick<GraphSnapshot, "coverage">;
  teamworkGraph: CapabilityAvailability["teamworkGraph"] | undefined;
}) {
  const rows = coverageRows(graph, teamworkGraph);
  return (
    <section className="ax-coverage" aria-labelledby="coverage-title">
      <h2 id="coverage-title" className="ax-coverage__title">
        Evidence sources
      </h2>
      <ul className="ax-coverage__list">
        {rows.map((r) => (
          <li key={r.name}>
            <span className="ax-coverage__name">{r.name}</span>
            <Badge tone={r.tone} size="sm">
              {r.label}
            </Badge>
            <span className="ax-coverage__detail">{r.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
