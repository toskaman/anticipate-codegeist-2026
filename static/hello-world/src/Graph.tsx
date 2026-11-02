import React, { useCallback, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { services as fixtureServices } from "./domain";
import { fixtureClient } from "./adapters";
import {
  type AnticipateClient,
  graphSchema,
} from "./api/provisional-contracts";
import { useResource } from "./useResource";
const emptyServices: typeof fixtureServices = [];
export default function Graph({
  client = fixtureClient,
  snapshotId = "demo-auth-v1-2026-11-02",
}: {
  client?: AnticipateClient;
  snapshotId?: string;
}) {
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const graph = graphSchema.parse(
        await client.request("getEvidenceGraph", { snapshotId }, signal),
      );
      if (graph.snapshotId !== snapshotId)
        throw new Error("Graph snapshot changed; refresh the evidence");
      return graph.services;
    },
    [client, snapshotId],
  );
  const resource = useResource(load);
  const services = resource.status === "ready" ? resource.data : emptyServices;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("checkout");
  const selected =
    services.find((service) => service.id === selectedId) ?? services[0];
  const visible = useMemo(
    () =>
      services.filter(
        (s) =>
          s.label.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "ALL" || s.evidence === filter),
      ),
    [services, query, filter],
  );
  const nodes = useMemo(
    () => [
      {
        id: "auth",
        position: { x: 320, y: 160 },
        data: { label: "Legacy authentication API v1" },
        className: "root-node",
      },
      ...visible.map((s, i) => ({
        id: s.id,
        position: { x: i < 3 ? 30 : 650, y: (i < 3 ? i : i - 3) * 140 },
        data: { label: s.label },
        className: s.id === selected?.id ? "selected-node" : "",
      })),
    ],
    [visible, selected],
  );
  const edges = visible.map((s) => ({
    id: s.id,
    source: s.id,
    target: "auth",
    label: s.evidence,
    style: {
      stroke: s.evidence === "UNKNOWN" ? "#efa958" : "#54b9b2",
      strokeWidth: s.id === selected?.id ? 3 : 1,
      strokeDasharray: s.evidence === "CONFIRMED" ? undefined : "5 5",
    },
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  if (resource.status === "loading")
    return (
      <section className="panel" role="status" aria-busy="true">
        <h2>Loading evidence snapshot…</h2>
        <p>Retrieving documented dependency relationships.</p>
      </section>
    );
  if (resource.status === "error")
    return (
      <section className="panel" role="alert">
        <h2>Evidence unavailable</h2>
        <p>{resource.error}</p>
        <button onClick={resource.retry}>Retry evidence</button>
      </section>
    );
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>The evidence behind the change</h2>
          <span className="badge">{services.length} fixture relationships</span>
        </div>
        <div className="filters">
          <label>
            Search dependencies
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
            />
          </label>
          <label>
            Evidence classification
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["ALL", "CONFIRMED", "INFERRED", "UNKNOWN"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="graph">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              onNodeClick={(_, n) => {
                const s = services.find((s) => s.id === n.id);
                if (s) setSelectedId(s.id);
              }}
              onEdgeClick={(_, e) => setSelectedId(e.id)}
            >
              <Background gap={24} />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          <p role="status">
            No dependencies match. Clear the search or change the filter.
          </p>
        )}
        <p className="muted">
          Solid: CONFIRMED · Dashed: INFERRED or UNKNOWN · Select a node or edge
          to highlight its path.
        </p>
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Accessible dependency list</h2>
          {visible.map((s) => (
            <button
              className="list-row"
              key={s.id}
              aria-pressed={s.id === selected?.id}
              onClick={() => setSelectedId(s.id)}
            >
              <span>{s.label}</span>
              <span className="badge">{s.evidence}</span>
            </button>
          ))}
        </section>
        {selected && visible.some((service) => service.id === selected.id) && (
          <section className="panel">
            <span className="eyebrow">SOURCE EVIDENCE</span>
            <h2>{selected.label}</h2>
            <span className="badge">{selected.evidence}</span>
            <p>{selected.detail}</p>
            <p className="muted">{selected.source}</p>
            <small>
              Fictional fixture reference; this is not a live repository
              citation.
            </small>
          </section>
        )}
      </div>
    </>
  );
}
