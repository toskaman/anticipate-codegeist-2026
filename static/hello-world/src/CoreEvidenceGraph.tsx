import React, { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphSnapshot, SimulationResult } from "@anticipate/contracts";

export function SourceLink({
  url,
  children,
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  const safe = url && /^https:\/\//i.test(url);
  return safe ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
export default function CoreEvidenceGraph({
  graph,
  result,
}: {
  graph: GraphSnapshot;
  result?: SimulationResult;
}) {
  const sizeForViewport = () =>
    window.innerWidth < 700 ? 6 : window.innerWidth < 1100 ? 12 : 20;
  const [pageSize, setPageSize] = useState(sizeForViewport);
  useEffect(() => {
    const resize = () => setPageSize(sizeForViewport());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const columns = pageSize === 6 ? 2 : pageSize === 12 ? 3 : 4;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const filtered = useMemo(
    () =>
      graph.nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(query.toLowerCase()) &&
          (status === "ALL" || n.status === status),
      ),
    [graph, query, status],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = useMemo(
    () => filtered.slice(current * pageSize, current * pageSize + pageSize),
    [filtered, current, pageSize],
  );
  const selected = visible.find((n) => n.id === selectedId) ?? visible[0];
  const { nodes, edges } = useMemo(() => {
    const ids = new Set(visible.map((n) => n.id));
    return {
      nodes: visible.map((n, i) => ({
        id: n.id,
        position: { x: (i % columns) * 240, y: Math.floor(i / columns) * 120 },
        data: { label: `${n.label} · ${n.status}` },
        className: n.id === selected?.id ? "selected-node" : "",
      })),
      edges: graph.edges
        .filter((e) => ids.has(e.from) && ids.has(e.to))
        .slice(0, 80)
        .map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          label: `${e.kind} · ${e.status}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: "#54b9b2",
            strokeDasharray: e.status === "CONFIRMED" ? undefined : "5 5",
          },
        })),
    };
  }, [graph, visible, selected?.id, columns]);
  const impact = result?.impacts.find((i) => i.nodeId === selected?.id);
  return (
    <>
      <section className="panel">
        <h2>Snapshot evidence</h2>
        <p>
          Snapshot {graph.snapshotId} · captured {graph.createdAt} · expires{" "}
          {graph.expiresAt}
        </p>
        <p>
          {graph.nodes.length} nodes · {graph.edges.length} relationships ·
          depth limit {graph.limits.maxDepth} · node limit{" "}
          {graph.limits.maxNodes}
        </p>
        {graph.truncated && (
          <p role="alert">
            Snapshot truncated. Unread evidence remains unknown.
          </p>
        )}
        <div className="filters">
          <label>
            Search CORE evidence
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            CORE evidence status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              {["ALL", "CONFIRMED", "INFERRED", "UNKNOWN"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="graph">
            <ReactFlow
              key={`${current}-${query}-${status}`}
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.1}
              fitViewOptions={{ padding: 0.18 }}
              onNodeClick={(_, node) => setSelectedId(node.id)}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          <p role="status">No evidence matches these filters.</p>
        )}
        <p>
          Showing {visible.length} of {filtered.length} matching nodes. Page{" "}
          {current + 1} of {pages}. Relationships outside this window are not
          drawn; at most 80 are shown. Snapshot freshness is not per-edge
          freshness.
        </p>
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous evidence
        </button>{" "}
        <button
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next evidence
        </button>
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Accessible CORE evidence list</h2>
          {visible.map((n) => (
            <button
              className="core-evidence-item"
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              aria-pressed={selected?.id === n.id}
            >
              {n.label} · {n.status}
            </button>
          ))}
        </section>
        <section className="panel">
          <h2>{selected?.label ?? "No selected evidence"}</h2>
          {selected && (
            <>
              <p>
                {selected.kind} · {selected.status}
              </p>
              <p>Node: {selected.id}</p>
              {selected.references.map((r, i) => (
                <p key={i}>
                  <SourceLink url={r.url}>
                    {r.sourceSystem}: {r.sourceId}
                  </SourceLink>{" "}
                  · {r.extractor} · {r.observedAt}
                </p>
              ))}
              {!selected.references.length && (
                <p>
                  No source reference supplied. Evidence is not assumed
                  confirmed.
                </p>
              )}
              {impact && (
                <>
                  <p>
                    {impact.direct ? "Direct" : "Transitive"} impact · depth{" "}
                    {impact.depth} · weakest evidence {impact.weakestStatus}
                  </p>
                  <p>Supplied path: {impact.pathEdgeIds.join(" → ")}</p>
                </>
              )}
              <h3>Supplied relationships</h3>
              {graph.edges
                .filter((e) => e.from === selected.id || e.to === selected.id)
                .slice(0, 20)
                .map((e) => (
                  <p key={e.id}>
                    {e.id}: {e.from} → {e.to} · {e.kind} · {e.status}
                    {e.accessLimited ? " · access limited" : ""}
                    {e.references.map((r, i) => (
                      <React.Fragment key={i}>
                        {" · "}
                        <SourceLink url={r.url}>{r.sourceId}</SourceLink>
                      </React.Fragment>
                    ))}
                  </p>
                ))}
              <p>
                At most 20 adjacent relationships listed. Use exported snapshot
                data for the complete payload.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
