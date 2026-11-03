import React, { useMemo, useState } from "react";
import type { GraphSnapshot, SimulationResult } from "@anticipate/contracts";
import {
  evidenceCopy,
  formatTime,
  plural,
  scenarioCopy,
  scenarioName,
  type EvidenceStatus,
} from "../app/copy";
import { impactDifference } from "../app/impactDifference";
import { Badge, Panel } from "./ui";

const VISIBLE_RECORDS = 6;

/** A local read-only inspector: it cannot select a decision or issue requests. */
export default function ScenarioDifference({
  results,
  graph,
}: {
  results: SimulationResult[];
  graph: GraphSnapshot | null;
}) {
  const [pair, setPair] = useState({
    left: results[0]?.scenarioId ?? "",
    right: results[1]?.scenarioId ?? "",
  });
  const left =
    results.find((result) => result.scenarioId === pair.left) ?? results[0];
  const right =
    results.find(
      (result) => result.scenarioId === pair.right && result !== left,
    ) ?? results.find((result) => result !== left);
  const names = useMemo(
    () => new Map(graph?.nodes.map((node) => [node.id, node.label]) ?? []),
    [graph],
  );
  if (!left || !right) return null;
  const diff = impactDifference(left, right);
  const hasSnapshot = graph?.snapshotId === left.snapshotId;
  const label = (id: string) => (hasSnapshot ? (names.get(id) ?? id) : id);
  const statusOf = (id: string): EvidenceStatus => {
    const statuses = [left, right].flatMap((result) =>
      result.impacts
        .filter((impact) => impact.nodeId === id)
        .map((impact) => impact.weakestStatus),
    );
    return statuses.includes("UNKNOWN")
      ? "UNKNOWN"
      : statuses.includes("INFERRED")
        ? "INFERRED"
        : "CONFIRMED";
  };
  const group = (title: string, ids: string[]) => (
    <section className="ax-option-diff__group" aria-label={title}>
      <h3>{title}</h3>
      <p className="ax-option-diff__count">{plural(ids.length, "record")}</p>
      {ids.length ? (
        <ul>
          {ids.slice(0, VISIBLE_RECORDS).map((id) => (
            <li key={id}>
              <span>{label(id)}</span>
              <Badge tone={evidenceCopy[statusOf(id)].tone} size="sm">
                {evidenceCopy[statusOf(id)].label}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ax-muted ax-small">No records listed in this group.</p>
      )}
      {ids.length > VISIBLE_RECORDS && (
        <p className="ax-muted ax-small">
          Showing {VISIBLE_RECORDS} of {ids.length}. Inspect the option's
          affected records below for the full result.
        </p>
      )}
    </section>
  );
  return (
    <Panel
      title="What differs between two options?"
      id="option-difference-title"
      className="ax-option-diff"
      description="Read-only inspection. Changing these selectors does not choose, approve or execute a decision."
    >
      <div className="ax-option-diff__selectors">
        <label>
          First option to inspect
          <select
            value={left.scenarioId}
            onChange={(event) =>
              setPair({
                left: event.target.value,
                right:
                  right.scenarioId === event.target.value
                    ? left.scenarioId
                    : right.scenarioId,
              })
            }
          >
            {results.map((result) => (
              <option key={result.scenarioId} value={result.scenarioId}>
                {scenarioName(result.scenarioId)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Second option to inspect
          <select
            value={right.scenarioId}
            onChange={(event) =>
              setPair({ left: left.scenarioId, right: event.target.value })
            }
          >
            {results
              .filter((result) => result !== left)
              .map((result) => (
                <option key={result.scenarioId} value={result.scenarioId}>
                  {scenarioName(result.scenarioId)}
                </option>
              ))}
          </select>
        </label>
      </div>
      {diff ? (
        <>
          <div className="ax-option-diff__groups">
            {group(
              `Only listed in ${scenarioName(left.scenarioId)}`,
              diff.leftOnly,
            )}
            {group("Listed in both options", diff.shared)}
            {group(
              `Only listed in ${scenarioName(right.scenarioId)}`,
              diff.rightOnly,
            )}
          </div>
          <div className="ax-option-diff__notes">
            {[
              { result: left, rules: diff.leftRules },
              { result: right, rules: diff.rightRules },
            ].map(({ result, rules }) => (
              <div key={result.scenarioId}>
                <h3>{scenarioName(result.scenarioId)}</h3>
                <p>
                  {plural(result.uncertainties.length, "open question")}{" "}
                  reported.
                </p>
                <p>
                  Rules triggered only in this option:{" "}
                  {rules.length ? rules.join(", ") : "none reported"}.
                </p>
                {scenarioCopy[result.scenarioId]?.assumes && (
                  <p className="ax-option-diff__assumption">
                    {scenarioCopy[result.scenarioId].assumes}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="ax-small ax-muted">
            This compares the impact records supplied by the simulations, not
            incident forecasts. A record absent from an option is not proof that
            it is safe. In shared records, the badge retains the weaker evidence
            of the two results.
          </p>
          <p className="ax-small ax-muted">
            {hasSnapshot
              ? `Same snapshot, captured ${formatTime(graph.createdAt)}.`
              : "Snapshot not loaded: original record IDs are shown; current Jira evidence has not been checked here."}
          </p>
        </>
      ) : (
        <p role="status">
          These results do not share a snapshot and cannot be compared here.
          Read fresh evidence and compare the options again.
        </p>
      )}
    </Panel>
  );
}
