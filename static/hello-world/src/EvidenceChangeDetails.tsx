import React from "react";
import { EvidenceDrift } from "@anticipate/contracts";

const differences = EvidenceDrift.pick({
  addedEdges: true,
  removedEdges: true,
  becameUnknown: true,
});
export default function EvidenceChangeDetails({
  details,
}: {
  details: unknown;
}) {
  const parsed = differences.safeParse(details);
  if (!parsed.success) return null;
  const { addedEdges, removedEdges, becameUnknown } = parsed.data;
  return (
    <div className="evidence-change-details">
      {(
        [
          ["Added relations", addedEdges],
          ["Removed relations", removedEdges],
        ] as const
      ).map(([label, edges]) => (
        <section key={label}>
          <h3>{label}</h3>
          <ul>
            {edges.map((edge, index) => (
              <li key={index}>
                {edge.from} {edge.kind} {edge.to} [{edge.status}]
              </li>
            ))}
          </ul>
          {!edges.length && <p>None reported.</p>}
        </section>
      ))}
      <h3>Evidence became unknown</h3>
      <ul>
        {becameUnknown.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      {!becameUnknown.length && <p>None reported.</p>}
    </div>
  );
}
