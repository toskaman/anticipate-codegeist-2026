import React, { useMemo } from "react";
import type {
  EvidenceStatus,
  GraphSnapshot,
  PortfolioConflict,
  SimulatePortfolioResult,
} from "@anticipate/contracts";
import { Badge } from "../components/ui";
import { evidenceCopy, verdictCopy } from "../app/copy";
import { causalPaths, conflictParties, triggeredRules } from "../app/collision";

/**
 * Causal Collision Explorer: why these changes collide, from recorded simulation
 * output only. No new backend calls; every path is computed on the supplied
 * snapshot and bounded. An empty section means "not shown", never "proven clear".
 */
export default function CollisionExplorer({
  result,
  graph,
  conflict,
  composerAvailable,
}: {
  result: SimulatePortfolioResult;
  graph: GraphSnapshot;
  conflict: PortfolioConflict;
  composerAvailable: boolean;
}) {
  const nodeLabel = (id: string) =>
    graph.nodes.find((n) => n.id === id)?.label ?? id;
  const nodeStatus = (id: string): EvidenceStatus =>
    graph.nodes.find((n) => n.id === id)?.status ?? "UNKNOWN";
  const parties = useMemo(
    () => conflictParties(result, conflict),
    [result, conflict],
  );
  const rules = useMemo(
    () => triggeredRules(result, conflict),
    [result, conflict],
  );
  const targets = useMemo(
    () =>
      result.individual
        .filter((c) => conflict.changeIds.includes(c.changeId))
        .flatMap((c) => c.targetNodeIds),
    [result, conflict],
  );
  const { paths, truncated } = useMemo(
    () => causalPaths(graph, [...new Set(targets)], conflict.nodeIds),
    [graph, targets, conflict],
  );
  const gaps = useMemo(
    () =>
      result.evidenceGaps.filter((e) =>
        conflict.changeIds.includes(e.changeId),
      ),
    [result, conflict],
  );
  const shown = conflict.nodeIds.slice(0, 20);
  return (
    <details className="ax-collision">
      <summary>
        Why these collide ({conflict.changeIds.length} changes,{" "}
        {conflict.nodeIds.length} affected records)
      </summary>
      <ol>
        {parties.map((p) => (
          <li key={p.changeId}>
            <strong>{p.label}</strong>{" "}
            <Badge tone={verdictCopy[p.verdict].tone} size="sm">
              Alone: {verdictCopy[p.verdict].label}
            </Badge>
          </li>
        ))}
      </ol>
      <p>
        Together:{" "}
        <Badge
          tone={verdictCopy[result.combined.result.verdict].tone}
          size="sm"
        >
          {verdictCopy[result.combined.result.verdict].label}
        </Badge>{" "}
        <span className="ax-muted">
          {conflict.kind.replace(/_/g, " ").toLowerCase()}
        </span>
      </p>
      <h4>Affected records</h4>
      <ul>
        {shown.map((id) => (
          <li key={id}>
            {nodeLabel(id)}{" "}
            <Badge tone={evidenceCopy[nodeStatus(id)].tone} size="sm">
              {evidenceCopy[nodeStatus(id)].label}
            </Badge>
          </li>
        ))}
      </ul>
      {conflict.nodeIds.length > shown.length && (
        <p className="ax-muted">
          Showing {shown.length} of {conflict.nodeIds.length} records. Omitted
          records are not assumed clear.
        </p>
      )}
      <h4>Causal paths in the supplied snapshot</h4>
      {paths.length ? (
        <ol>
          {paths.map((p, i) => (
            <li key={i}>
              {p.nodes.map(nodeLabel).join(" → ")}{" "}
              <Badge tone={evidenceCopy[p.weakestStatus].tone} size="sm">
                {evidenceCopy[p.weakestStatus].label}
              </Badge>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ax-muted">
          No dependent path found between these changes and the affected records
          in the supplied snapshot. Absence of a path is not proof of safety.
        </p>
      )}
      {truncated && (
        <p className="ax-muted">
          Path search hit its bound; more paths may exist.
        </p>
      )}
      {rules.length > 0 && (
        <>
          <h4>Triggered rules</h4>
          <ul>
            {rules.map((r) => (
              <li key={`${r.scope}|${r.ruleId}|${r.explanation}`}>
                <strong>{r.scope}</strong>: {r.explanation}
              </li>
            ))}
          </ul>
        </>
      )}
      {gaps.some((g) => g.gaps.length > 0) && (
        <>
          <h4>Evidence gaps on this collision</h4>
          <ul>
            {gaps.flatMap((g) =>
              g.gaps.map((gap) => (
                <li key={gap.edgeId}>
                  {nodeLabel(gap.from)} → {nodeLabel(gap.to)} · relationship{" "}
                  {gap.edgeId}
                </li>
              )),
            )}
          </ul>
        </>
      )}
      {composerAvailable && (
        <p className="ax-muted">
          Bounded alternatives to this collision are ranked in Safe Change
          Composer below.
        </p>
      )}
    </details>
  );
}
