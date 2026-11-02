import React from "react";
import type { GraphSnapshot } from "@anticipate/contracts";
import { Badge, SourceLink } from "./ui";
import { edgeKindCopy, evidenceCopy, type EvidenceStatus } from "../app/copy";

/**
 * Renders a backend-supplied edge path in order. Edges missing from the snapshot are
 * shown as missing — never reconstructed or guessed.
 */
export default function EvidencePath({
  graph,
  edgeIds,
  label,
}: {
  graph: GraphSnapshot | null;
  edgeIds: string[];
  label: string;
}) {
  if (!edgeIds.length)
    return (
      <p className="ax-muted">
        The backend supplied no relationship path for this item.
      </p>
    );
  const nodeLabel = (id: string) =>
    graph?.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <ol className="ax-path" aria-label={label}>
      {edgeIds.map((id, i) => {
        const edge = graph?.edges.find((e) => e.id === id);
        if (!edge)
          return (
            <li
              key={`${id}-${i}`}
              className="ax-path__step ax-path__step--missing"
            >
              <span className="ax-path__index" aria-hidden="true">
                {i + 1}
              </span>
              <div className="ax-path__body">
                <p className="ax-path__line">
                  Relationship <code className="ax-code">{id}</code> is not in
                  the loaded snapshot.
                </p>
                <Badge tone="warning" size="sm">
                  Not verifiable here
                </Badge>
              </div>
            </li>
          );
        const status = edge.status as EvidenceStatus;
        return (
          <li
            key={`${id}-${i}`}
            className={`ax-path__step ax-path__step--${status.toLowerCase()}`}
          >
            <span className="ax-path__index" aria-hidden="true">
              {i + 1}
            </span>
            <div className="ax-path__body">
              <p className="ax-path__line">
                <strong>{nodeLabel(edge.from)}</strong>{" "}
                <span className="ax-path__kind">
                  {edgeKindCopy[edge.kind] ?? edge.kind}
                </span>{" "}
                <strong>{nodeLabel(edge.to)}</strong>
              </p>
              <div className="ax-path__meta">
                <Badge tone={evidenceCopy[status].tone} size="sm">
                  {evidenceCopy[status].label}
                </Badge>
                {edge.accessLimited && (
                  <Badge tone="warning" icon="lock" size="sm">
                    Access limited
                  </Badge>
                )}
                {edge.references.length ? (
                  edge.references.map((r, j) => (
                    <span key={j} className="ax-path__source">
                      <SourceLink url={r.url}>
                        {r.sourceSystem} {r.sourceId}
                      </SourceLink>
                      <span className="ax-muted"> · {r.extractor}</span>
                    </span>
                  ))
                ) : (
                  <span className="ax-muted">No source reference supplied</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
