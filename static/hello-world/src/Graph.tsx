import React, { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fixtureClient } from "./adapters";
import {
  type AnticipateClient,
  graphSchema,
} from "./api/provisional-contracts";
import { useResource } from "./useResource";
import {
  graphPage,
  pathToRoot,
  indexGraph,
  type EvidenceGraph,
} from "./graphModel";
const emptyGraph: EvidenceGraph = {
  mode: "fixture",
  snapshotId: "",
  root: { id: "auth", label: "Change" },
  services: [],
  edges: [],
};
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
      return graph;
    },
    [client, snapshotId],
  );
  const resource = useResource(load);
  const graph = resource.status === "ready" ? resource.data : emptyGraph;
  const graphIndex = useMemo(() => indexGraph(graph), [graph]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [freshness, setFreshness] = useState("ALL");
  const [impact, setImpact] = useState("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("checkout");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const windowed = useMemo(
    () => graphPage(graph, query, filter, freshness, impact, page, graphIndex),
    [graph, query, filter, freshness, impact, page, graphIndex],
  );
  const selected =
    windowed.services.find((service) => service.id === selectedId) ??
    windowed.services[0];
  const path = useMemo(
    () => (selected ? pathToRoot(graph, selected.id, graphIndex) : []),
    [graph, selected, graphIndex],
  );
  const displayed = useMemo(() => {
    const ids = new Set(windowed.services.map((service) => service.id));
    for (const edge of path.slice(0, 20)) {
      ids.add(edge.source);
      ids.add(edge.target);
    }
    return graph.services.filter((service) => ids.has(service.id));
  }, [graph, windowed.services, path]);
  const { flowNodes, edges } = useMemo(() => {
    const pathIds = new Set(path.map((edge) => edge.id));
    const nodes = [
      {
        id: graph.root.id,
        position: { x: 320, y: displayed.length > 5 ? -130 : 160 },
        data: { label: graph.root.label },
        className: "root-node",
      },
      ...displayed.map((service, index) => ({
        id: service.id,
        position:
          displayed.length > 5
            ? { x: (index % 4) * 225, y: Math.floor(index / 4) * 110 }
            : {
                x: index < 3 ? 30 : 650,
                y: (index < 3 ? index : index - 3) * 140,
              },
        data: { label: service.label },
        className: service.id === selected?.id ? "selected-node" : "",
      })),
    ];
    const positions = new Map(nodes.map((node) => [node.id, node.position]));
    const flowNodes = nodes.map((node) => {
      const outgoing = graphIndex.outgoing.get(node.id)?.[0];
      const incoming = graphIndex.incoming.get(node.id);
      const destination = outgoing ? positions.get(outgoing.target) : undefined;
      const origin = incoming ? positions.get(incoming.source) : undefined;
      return {
        ...node,
        sourcePosition:
          destination && destination.y < node.position.y
            ? Position.Top
            : Position.Bottom,
        targetPosition:
          origin && origin.y > node.position.y ? Position.Bottom : Position.Top,
      };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const availableEdges = graph.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );
    const edgeWindow = Array.from(
      new Map(
        [
          ...path.filter(
            (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
          ),
          ...availableEdges,
        ].map((edge) => [edge.id, edge]),
      ).values(),
    ).slice(0, 80);
    const edges = edgeWindow.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: `${edge.relation} · ${edge.evidence}`,
      style: {
        stroke:
          edge.evidence === "UNKNOWN"
            ? "#efa958"
            : edge.freshness === "STALE"
              ? "#a5a8b8"
              : "#54b9b2",
        strokeWidth: pathIds.has(edge.id) ? 3 : 1,
        strokeDasharray: edge.evidence === "CONFIRMED" ? undefined : "5 5",
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { flowNodes, edges };
  }, [graph, displayed, path, selected?.id, graphIndex]);
  const selectedEdge =
    graph.edges.find(
      (edge) => edge.id === selectedEdgeId && edge.source === selected?.id,
    ) ?? graph.edges.find((edge) => edge.source === selected?.id);
  function selectService(id: string, edgeId: string | null = null) {
    const index = graph.services.findIndex((service) => service.id === id);
    if (index < 0) return;
    if (!windowed.services.some((service) => service.id === id)) {
      setQuery("");
      setFilter("ALL");
      setFreshness("ALL");
      setImpact("ALL");
      setPage(Math.floor(index / 20));
    }
    setSelectedId(id);
    setSelectedEdgeId(edgeId);
  }
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
          <span className="badge">
            {graph.edges.length} {graph.mode === "fixture" ? "fixture " : ""}
            relationships
          </span>
        </div>
        <div className="filters">
          <label>
            Search dependencies
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search services…"
            />
          </label>
          <label>
            Evidence classification
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(0);
              }}
            >
              {["ALL", "CONFIRMED", "INFERRED", "UNKNOWN"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Evidence freshness
            <select
              value={freshness}
              onChange={(event) => {
                setFreshness(event.target.value);
                setPage(0);
              }}
            >
              {["ALL", "FRESH", "STALE", "UNKNOWN"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Impact scope
            <select
              value={impact}
              onChange={(event) => {
                setImpact(event.target.value);
                setPage(0);
              }}
            >
              {["ALL", "DIRECT", "TRANSITIVE"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {windowed.services.length ? (
          <div className="graph">
            <ReactFlow
              key={`${windowed.currentPage}-${query}-${filter}-${freshness}-${impact}`}
              nodes={flowNodes}
              edges={edges}
              fitView
              onNodeClick={(_, node) => selectService(node.id)}
              onEdgeClick={(_, edge) => selectService(edge.source, edge.id)}
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
          Solid: CONFIRMED · Dashed: INFERRED or UNKNOWN. CALLS, ROUTES, TESTS
          and DEPENDS_ON describe the supplied relation. Freshness and
          direct/transitive scope are source metadata, not inferred from an AI
          answer.
        </p>
        <p>
          Showing {windowed.services.length} of {windowed.total} matching
          dependencies. Page {windowed.currentPage + 1} of {windowed.totalPages}
          .
        </p>
        {windowed.totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={windowed.currentPage === 0}
              onClick={() => setPage(windowed.currentPage - 1)}
            >
              Previous dependencies
            </button>
            <button
              disabled={windowed.currentPage + 1 >= windowed.totalPages}
              onClick={() => setPage(windowed.currentPage + 1)}
            >
              Next dependencies
            </button>
          </div>
        )}
        <p className="muted">
          The visual window is bounded to 20 listed dependencies plus at most 20
          path steps and 80 relationships. Relations outside this window are not
          drawn.
        </p>
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Accessible dependency list</h2>
          {windowed.services.map((service) => (
            <button
              className="list-row"
              key={service.id}
              aria-pressed={service.id === selected?.id}
              onClick={() => {
                setSelectedId(service.id);
                setSelectedEdgeId(null);
              }}
            >
              <span>{service.label}</span>
              <span className="badge">{service.evidence}</span>
            </button>
          ))}
        </section>
        {selected && (
          <section className="panel">
            <span className="eyebrow">SOURCE EVIDENCE</span>
            <h2>{selected.label}</h2>
            <span className="badge">{selected.evidence}</span>
            <p>{selected.detail}</p>
            {selectedEdge ? (
              <>
                <p>
                  {selectedEdge.relation} · {selectedEdge.impact} ·{" "}
                  {selectedEdge.freshness}
                </p>
                <p>Observed: {selectedEdge.observedAt ?? "Not supplied"}</p>
                <p>
                  {selectedEdge.sourceUrl ? (
                    <a
                      href={selectedEdge.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedEdge.sourceReference}
                    </a>
                  ) : (
                    selectedEdge.sourceReference
                  )}
                </p>
                <h3>Supplied provenance</h3>
                <p>{selectedEdge.provenance.join(" → ")}</p>
              </>
            ) : (
              <p>No source relationship supplied for this dependency.</p>
            )}
            <h3>Dependency path to change</h3>
            {path.length ? (
              <p>
                {path
                  .slice(0, 20)
                  .map((edge) => edge.source)
                  .join(" → ")}{" "}
                →{" "}
                {path.length > 20
                  ? "path continues outside this window"
                  : graph.root.id}
              </p>
            ) : (
              <p>
                No path to this change can be verified from the supplied graph.
              </p>
            )}
            <small>
              {graph.mode === "fixture"
                ? "Fictional fixture references, not live repository citations."
                : "Evidence classification and provenance supplied by the backend."}
            </small>
          </section>
        )}
      </div>
    </>
  );
}
