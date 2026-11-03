import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  GraphSnapshot,
  ScenarioComparison,
  SimulationResult,
} from "@anticipate/contracts";
import Icon, { type IconName } from "../../components/Icon";
import {
  Badge,
  Metric,
  Notice,
  SourceLink,
  TechDetails,
  KeyValues,
} from "../../components/ui";
import EvidencePath from "../../components/EvidencePath";
import {
  edgeKindCopy,
  evidenceCopy,
  formatTime,
  nodeKindCopy,
  plural,
  scenarioName,
  verdictCopy,
  type EvidenceStatus,
} from "../../app/copy";
import { hopDistances, layeredLayout, orderNodes, NODE_W } from "./layout";
import { milestone, recordRender, startTimer } from "../../app/perf";
import { focusedEvidence } from "./focusedEvidence";

const kindIcon: Record<string, IconName> = {
  ISSUE: "target",
  PROJECT: "scenarios",
  COMPONENT: "settings",
  SERVICE: "plug",
  RELEASE: "sparkline",
  TEST: "check",
  DOCUMENT: "passport",
  DECISION: "shield",
};

type Emphasis = "normal" | "selected" | "path" | "dim";
type EvidenceNodeData = {
  label: string;
  kind: string;
  status: EvidenceStatus;
  isRoot: boolean;
  emphasis: Emphasis;
  impact: "direct" | "transitive" | null;
};

const EvidenceNodeView = memo(function EvidenceNodeView({
  data,
}: NodeProps<Node<EvidenceNodeData>>) {
  const status = evidenceCopy[data.status];
  return (
    <div
      className={[
        "ax-node",
        `ax-node--${data.status.toLowerCase()}`,
        `ax-node--${data.emphasis}`,
        data.isRoot ? "ax-node--root" : "",
      ].join(" ")}
      style={{ width: NODE_W }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="l"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="ls"
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="rt"
        isConnectable={false}
      />
      <span className="ax-node__icon" aria-hidden="true">
        <Icon name={kindIcon[data.kind] ?? "dot"} size={15} />
      </span>
      <span className="ax-node__body">
        <span className="ax-node__meta">
          {data.isRoot ? "The change" : (nodeKindCopy[data.kind] ?? data.kind)}
          {data.impact && (
            <span className="ax-node__impact">
              {data.impact === "direct" ? "Direct impact" : "Transitive impact"}
            </span>
          )}
        </span>
        <span className="ax-node__label" title={data.label}>
          {data.label}
        </span>
        <span className="ax-node__status">
          <span
            className={`ax-evidence-mark ax-evidence-mark--${data.status.toLowerCase()}`}
          />
          {status.label}
        </span>
      </span>
    </div>
  );
});
const nodeTypes = { evidence: EvidenceNodeView };

const sizeForViewport = () =>
  window.innerWidth < 700 ? 8 : window.innerWidth < 1100 ? 20 : 36;

const statusFilters = ["ALL", "CONFIRMED", "INFERRED", "UNKNOWN"] as const;

export default function EvidenceGraph({
  graph,
  rootId,
  comparison,
  scenarioId,
}: {
  graph: GraphSnapshot;
  rootId: string;
  comparison: ScenarioComparison | null;
  scenarioId: string;
}) {
  const [pageSize, setPageSize] = useState(sizeForViewport);
  const renderStart = useRef(startTimer());
  useEffect(() => {
    // Layout + first commit of the map for this snapshot (after lazy load).
    recordRender(
      "Dependency map first render",
      renderStart.current(),
      `${graph.nodes.length} records, ${graph.edges.length} relationships`,
    );
    milestone("Dependency map shown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [focusPath, setFocusPath] = useState(false);
  // Overlay choice is local: viewing another option never changes the decision.
  const [overlayId, setOverlayId] = useState(scenarioId);
  const overlay: SimulationResult | undefined =
    comparison?.results.find((r) => r.scenarioId === overlayId) ??
    comparison?.results.find((r) => r.scenarioId === scenarioId);

  const distance = useMemo(() => hopDistances(graph, rootId), [graph, rootId]);
  const ordered = useMemo(
    () => orderNodes(graph.nodes, distance),
    [graph, distance],
  );
  const counts = useMemo(() => {
    const c = { CONFIRMED: 0, INFERRED: 0, UNKNOWN: 0 } as Record<
      EvidenceStatus,
      number
    >;
    for (const n of graph.nodes) c[n.status as EvidenceStatus]++;
    const e = { CONFIRMED: 0, INFERRED: 0, UNKNOWN: 0 } as Record<
      EvidenceStatus,
      number
    >;
    for (const x of graph.edges) e[x.status as EvidenceStatus]++;
    return { nodes: c, edges: e };
  }, [graph]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter(
      (n) =>
        (!q ||
          n.label.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q)) &&
        (status === "ALL" || n.status === status),
    );
  }, [ordered, query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = useMemo(
    () => filtered.slice(current * pageSize, current * pageSize + pageSize),
    [filtered, current, pageSize],
  );
  const selected =
    visible.find((n) => n.id === selectedId) ??
    visible.find((n) => n.id === rootId) ??
    visible[0];

  // Keep the selected evidence in the window when the viewport changes size.
  useEffect(() => {
    const resize = () => {
      const nextSize = sizeForViewport();
      if (nextSize === pageSize) return;
      const index = filtered.findIndex((node) => node.id === selected?.id);
      setPage(Math.max(0, Math.floor(index / nextSize)));
      setPageSize(nextSize);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [filtered, selected?.id, pageSize]);

  const impact = overlay?.impacts.find((i) => i.nodeId === selected?.id);
  const impactByNode = useMemo(
    () => new Map((overlay?.impacts ?? []).map((i) => [i.nodeId, i])),
    [overlay],
  );
  // Highlight only edges the backend supplied as the causal path for the selection.
  const pathEdges = useMemo(() => new Set(impact?.pathEdgeIds ?? []), [impact]);
  const pathNodes = useMemo(() => {
    const ids = new Set<string>();
    for (const e of graph.edges)
      if (pathEdges.has(e.id)) {
        ids.add(e.from);
        ids.add(e.to);
      }
    return ids;
  }, [graph, pathEdges]);
  const highlighting = pathEdges.size > 0;
  const pathView = focusPath && highlighting;
  const focused = useMemo(
    () =>
      focusedEvidence(
        graph,
        impact?.pathEdgeIds ?? [],
        rootId,
        selected?.id ?? rootId,
      ),
    [graph, impact, rootId, selected?.id],
  );
  const mapNodes = pathView ? focused.nodes : visible;
  const selectNode = (id: string) => {
    const index = filtered.findIndex((node) => node.id === id);
    if (index >= 0) setPage(Math.floor(index / pageSize));
    else {
      setQuery("");
      setStatus("ALL");
      setPage(
        Math.max(
          0,
          Math.floor(ordered.findIndex((node) => node.id === id) / pageSize),
        ),
      );
    }
    setSelectedId(id);
    setFocusPath(false);
  };

  const layout = useMemo(
    () => layeredLayout(mapNodes, distance, 4),
    [mapNodes, distance],
  );
  const visibleIds = useMemo(
    () => new Set(mapNodes.map((n) => n.id)),
    [mapNodes],
  );
  const windowEdges = useMemo(
    () =>
      pathView
        ? focused.edges
        : graph.edges.filter(
            (e) => visibleIds.has(e.from) && visibleIds.has(e.to),
          ),
    [graph, visibleIds, pathView, focused.edges],
  );
  const drawnEdges = useMemo(() => windowEdges.slice(0, 120), [windowEdges]);
  const nodes: Node<EvidenceNodeData>[] = useMemo(
    () =>
      mapNodes.map((n) => {
        const emphasis: Emphasis =
          n.id === selected?.id
            ? "selected"
            : highlighting
              ? pathNodes.has(n.id)
                ? "path"
                : "dim"
              : "normal";
        const record = impactByNode.get(n.id);
        return {
          id: n.id,
          type: "evidence",
          position: layout.positions.get(n.id) ?? { x: 0, y: 0 },
          data: {
            label: n.label,
            kind: n.kind,
            status: n.status as EvidenceStatus,
            isRoot: n.id === rootId,
            emphasis,
            impact: record ? (record.direct ? "direct" : "transitive") : null,
          },
          ariaLabel: `${n.label}. ${nodeKindCopy[n.kind] ?? n.kind}. Evidence ${evidenceCopy[n.status as EvidenceStatus].label}${record ? `. ${record.direct ? "Direct" : "Transitive"} impact in ${scenarioName(overlay!.scenarioId)}` : ""}.`,
          draggable: false,
          connectable: false,
          selectable: false,
        };
      }),
    [
      mapNodes,
      layout,
      selected?.id,
      highlighting,
      pathNodes,
      impactByNode,
      rootId,
      overlay,
    ],
  );
  const edges: Edge[] = useMemo(
    () =>
      drawnEdges.map((e) => {
        const a = layout.positions.get(e.from)!;
        const b = layout.positions.get(e.to)!;
        const forward = a.x <= b.x;
        const sameColumn = a.x === b.x;
        const onPath = pathEdges.has(e.id);
        const tone = e.status.toLowerCase();
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: sameColumn ? "r" : forward ? "r" : "ls",
          targetHandle: sameColumn ? "rt" : forward ? "l" : "rt",
          className: [
            `ax-edge--${tone}`,
            onPath ? "is-path" : highlighting ? "is-dim" : "",
          ].join(" "),
          label:
            onPath || drawnEdges.length <= 6
              ? (edgeKindCopy[e.kind] ?? e.kind)
              : undefined,
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: `var(--ax-ev-${tone})`,
          },
          focusable: false,
          selectable: false,
        };
      }),
    [drawnEdges, layout, pathEdges, highlighting],
  );
  // Height follows the layout's aspect ratio at the measured width, so a wide graph
  // does not leave an empty canvas and a tall one does not shrink to unreadable size.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setCanvasWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fitZoom = Math.min(1, (canvasWidth - 48) / layout.width);
  const canvasHeight = Math.round(
    Math.max(300, Math.min(640, layout.height * fitZoom + 110)),
  );
  const adjacent = graph.edges
    .filter((e) => e.from === selected?.id || e.to === selected?.id)
    .slice(0, 20);
  const omittedEdges = windowEdges.length - drawnEdges.length;

  return (
    <>
      <section
        className="ax-panel ax-graph-panel"
        aria-labelledby="graph-title"
      >
        <div className="ax-panel__head">
          <div>
            <h2 id="graph-title">Dependency map</h2>
            <p className="ax-panel__desc">
              Everything ANTICIPATE could read around{" "}
              <strong>
                {graph.nodes.find((n) => n.id === rootId)?.label ?? rootId}
              </strong>
              , captured {formatTime(graph.createdAt)}.
            </p>
          </div>
        </div>
        <div className="ax-metrics">
          <Metric value={graph.nodes.length} label="Records" />
          <Metric value={graph.edges.length} label="Relationships" />
          <Metric
            value={counts.edges.CONFIRMED}
            label="Confirmed links"
            tone="accent"
          />
          <Metric
            value={counts.edges.INFERRED}
            label="Inferred links"
            tone="info"
          />
          <Metric
            value={counts.edges.UNKNOWN}
            label="Unknown links"
            tone="warning"
          />
        </div>
        {graph.truncated && (
          <Notice tone="warning" role="alert" title="Snapshot truncated">
            The read limit was reached ({graph.limits.maxNodes} records, depth{" "}
            {graph.limits.maxDepth}). Unread evidence remains unknown.
          </Notice>
        )}
        {comparison && overlay && (
          <div
            className="ax-overlay"
            role="group"
            aria-labelledby="overlay-label"
          >
            <span id="overlay-label" className="ax-overlay__label">
              <Icon name="scenarios" size={14} />
              Show simulated impact for
            </span>
            <div className="ax-segmented">
              {comparison.results.map((r) => (
                <button
                  key={r.scenarioId}
                  className="ax-segmented__btn"
                  aria-pressed={overlay.scenarioId === r.scenarioId}
                  onClick={() => {
                    setOverlayId(r.scenarioId);
                    setFocusPath(false);
                  }}
                >
                  {scenarioName(r.scenarioId)}
                  <span
                    className={`ax-dot ax-dot--${verdictCopy[r.verdict].tone}`}
                    aria-hidden="true"
                  />
                  <span className="ax-sr">
                    : {verdictCopy[r.verdict].label}
                  </span>
                </button>
              ))}
            </div>
            <span className="ax-overlay__hint">
              Viewing an option here does not change your selected decision.
            </span>
          </div>
        )}
        <div className="ax-graph-toolbar">
          <div className="ax-search">
            <Icon name="search" size={15} />
            <label htmlFor="graph-search" className="ax-sr">
              Search evidence
            </label>
            <input
              id="graph-search"
              type="search"
              placeholder="Search records"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
                setFocusPath(false);
              }}
            />
          </div>
          <div
            className="ax-segmented"
            role="group"
            aria-label="Filter by evidence"
          >
            {statusFilters.map((v) => (
              <button
                key={v}
                className="ax-segmented__btn"
                aria-pressed={status === v}
                onClick={() => {
                  setStatus(v);
                  setPage(0);
                  setFocusPath(false);
                }}
              >
                {v !== "ALL" && (
                  <span
                    className={`ax-evidence-mark ax-evidence-mark--${v.toLowerCase()}`}
                    aria-hidden="true"
                  />
                )}
                {v === "ALL" ? "All" : evidenceCopy[v].label}
                <span className="ax-segmented__count">
                  {v === "ALL" ? graph.nodes.length : counts.nodes[v]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="ax-graph-path-controls">
          <button
            className="ax-btn ax-btn--ghost"
            aria-pressed={pathView}
            disabled={!highlighting}
            aria-describedby="graph-path-hint"
            onClick={() => setFocusPath(!pathView)}
          >
            <Icon name="graph" size={15} />
            {pathView ? "Return to map overview" : "Focus supplied impact path"}
          </button>
          <p id="graph-path-hint" className="ax-muted ax-small">
            {highlighting
              ? "Focus uses only the simulation's supplied relationships. The evidence list and your decision stay unchanged."
              : "Compare options and select an affected record with a supplied path to focus the map. No causal relationship is invented."}
          </p>
        </div>
        {pathView &&
          (focused.missingEdges.length > 0 ||
            focused.missingNodes.length > 0 ||
            focused.omittedNodes > 0 ||
            focused.omittedEdges > 0) && (
            <Notice tone="warning" title="Path context is incomplete">
              {focused.missingEdges.length} supplied relationships and{" "}
              {focused.missingNodes.length} endpoints are missing from the
              snapshot. {focused.omittedNodes} loaded records and{" "}
              {focused.omittedEdges} loaded relationships are outside this
              bounded map. Missing relationships are never reconstructed;
              inspect the ordered impact path for details.
            </Notice>
          )}
        <div className="ax-graph-layout">
          <div className="ax-graph-canvas-wrap" ref={wrapRef}>
            {mapNodes.length ? (
              <div
                className={`ax-graph ${highlighting ? "is-highlighting" : ""}`}
                style={{ height: canvasHeight }}
                role="group"
                aria-label="Dependency map canvas. Use the evidence list below for a keyboard-friendly alternative."
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  const el = (e.target as HTMLElement).closest(
                    ".react-flow__node",
                  );
                  const id = el?.getAttribute("data-id");
                  if (id) {
                    e.preventDefault();
                    selectNode(id);
                  }
                }}
              >
                <div className="ax-graph__lanes" aria-hidden="true">
                  {layout.columns.map((c) => (
                    <span key={c.key}>{c.label}</span>
                  ))}
                </div>
                <ReactFlow
                  key={`${pageSize}-${current}-${query}-${status}-${pathView}`}
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView={pageSize !== 8}
                  defaultViewport={
                    pageSize === 8
                      ? {
                          x: 12,
                          y:
                            canvasHeight / 2 -
                            ((layout.positions.get(mapNodes[0]?.id)?.y ?? 0) +
                              45) *
                              0.9,
                          zoom: 0.9,
                        }
                      : undefined
                  }
                  fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
                  minZoom={0.2}
                  maxZoom={1.75}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  edgesFocusable={false}
                  onNodeClick={(_, node) => selectNode(node.id)}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={22}
                    size={1}
                  />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>
              </div>
            ) : (
              <div className="ax-graph ax-graph--empty" role="status">
                <Icon name="search" size={20} />
                <p>No evidence matches these filters.</p>
              </div>
            )}
            <div className="ax-graph-footer">
              {pageSize === 8 && (
                <p className="ax-muted">
                  The mobile map starts at a readable zoom and shows part of the
                  layout. Pan, zoom out, or use the evidence list to inspect
                  every record.
                </p>
              )}
              {pathView ? (
                <p className="ax-muted" id="graph-window" role="status">
                  Focused map: {mapNodes.length} records and {drawnEdges.length}{" "}
                  relationships from the supplied impact path, with
                  change/selection context. The paginated evidence list keeps
                  its filters; the inspector's ordered impact path remains the
                  textual alternative.
                </p>
              ) : (
                <p className="ax-muted" id="graph-window">
                  Showing {visible.length} of {filtered.length} matching records
                  {pages > 1 && ` · page ${current + 1} of ${pages}`}.
                  Relationships to records outside this page are not drawn
                  {omittedEdges > 0 &&
                    ` (${omittedEdges} more on this page are listed but not drawn)`}
                  . Layout columns show hop distance only — not impact.
                </p>
              )}
              {pages > 1 && (
                <div className="ax-pager">
                  <button
                    className="ax-btn ax-btn--ghost"
                    disabled={current === 0}
                    onClick={() => {
                      setPage(current - 1);
                      setFocusPath(false);
                    }}
                  >
                    Previous evidence
                  </button>
                  <button
                    className="ax-btn ax-btn--ghost"
                    disabled={current + 1 >= pages}
                    onClick={() => {
                      setPage(current + 1);
                      setFocusPath(false);
                    }}
                  >
                    Next evidence
                  </button>
                </div>
              )}
            </div>
            <ul className="ax-legend" aria-label="Legend">
              {(["CONFIRMED", "INFERRED", "UNKNOWN"] as const).map((s) => (
                <li key={s}>
                  <span
                    className={`ax-legend__line ax-legend__line--${s.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <strong>{evidenceCopy[s].label}</strong>
                  <span>{evidenceCopy[s].description}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="ax-inspector" aria-labelledby="inspector-title">
            <p className="ax-sr" aria-live="polite">
              {selected ? `Inspecting ${selected.label}` : ""}
            </p>
            {selected ? (
              <>
                <p className="ax-eyebrow">
                  <Icon name={kindIcon[selected.kind] ?? "dot"} size={13} />
                  {selected.id === rootId
                    ? "The change"
                    : (nodeKindCopy[selected.kind] ?? selected.kind)}
                </p>
                <h2 id="inspector-title" className="ax-inspector__title">
                  {selected.label}
                </h2>
                <div className="ax-badges">
                  <Badge
                    tone={evidenceCopy[selected.status as EvidenceStatus].tone}
                  >
                    {evidenceCopy[selected.status as EvidenceStatus].label}{" "}
                    evidence
                  </Badge>
                  {impact && (
                    <Badge
                      tone={impact.direct ? "danger" : "warning"}
                      icon="graph"
                    >
                      {impact.direct ? "Direct" : "Transitive"} impact ·{" "}
                      {plural(impact.depth, "hop")}
                    </Badge>
                  )}
                </div>
                <p className="ax-inspector__desc">
                  {evidenceCopy[selected.status as EvidenceStatus].description}
                </p>
                <h3 className="ax-h4">Sources</h3>
                {selected.references.length ? (
                  <ul className="ax-sources">
                    {selected.references.map((r, i) => (
                      <li key={i}>
                        <SourceLink url={r.url}>
                          {r.sourceSystem} · {r.sourceId}
                        </SourceLink>
                        <span className="ax-muted">
                          {r.extractor} · observed {formatTime(r.observedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ax-muted">
                    No source reference supplied. Evidence is not assumed
                    confirmed.
                  </p>
                )}
                <div className="ax-inspector__col2">
                  {impact ? (
                    <>
                      <h3 className="ax-h4">
                        Why it is affected in “
                        {scenarioName(overlay!.scenarioId)}”
                      </h3>
                      <p className="ax-muted ax-small">
                        Path supplied by the simulation, from the change to this
                        record. Weakest evidence on the path:{" "}
                        {
                          evidenceCopy[impact.weakestStatus as EvidenceStatus]
                            .label
                        }
                        .
                      </p>
                      <EvidencePath
                        graph={graph}
                        edgeIds={impact.pathEdgeIds}
                        label={`Impact path to ${selected.label}`}
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="ax-h4">Adjacent relationships</h3>
                      <p className="ax-muted ax-small">
                        {comparison
                          ? "This record has no impact in the option shown. Relationships below are links, not impact claims."
                          : "Links, not impact claims. Compare options to see simulated impact paths."}
                      </p>
                      {adjacent.length ? (
                        <ul className="ax-adjacent">
                          {adjacent.map((e) => {
                            const other =
                              e.from === selected.id ? e.to : e.from;
                            const otherLabel =
                              graph.nodes.find((n) => n.id === other)?.label ??
                              other;
                            return (
                              <li key={e.id}>
                                <span
                                  className={`ax-evidence-mark ax-evidence-mark--${e.status.toLowerCase()}`}
                                  aria-hidden="true"
                                />
                                <span>
                                  {e.from === selected.id ? (
                                    <>
                                      This record{" "}
                                      <em>{edgeKindCopy[e.kind] ?? e.kind}</em>{" "}
                                      <strong>{otherLabel}</strong>
                                    </>
                                  ) : (
                                    <>
                                      <strong>{otherLabel}</strong>{" "}
                                      <em>{edgeKindCopy[e.kind] ?? e.kind}</em>{" "}
                                      this record
                                    </>
                                  )}
                                  <span className="ax-muted">
                                    {" "}
                                    ·{" "}
                                    {
                                      evidenceCopy[e.status as EvidenceStatus]
                                        .label
                                    }
                                    {e.accessLimited ? " · access limited" : ""}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="ax-muted">
                          No relationships supplied for this record.
                        </p>
                      )}
                      {adjacent.length === 20 && (
                        <p className="ax-muted ax-small">
                          At most 20 adjacent relationships listed. Export the
                          snapshot for the complete payload.
                        </p>
                      )}
                    </>
                  )}
                  <TechDetails>
                    <KeyValues
                      compact
                      items={[
                        [
                          "Node ID",
                          <code className="ax-code">{selected.id}</code>,
                        ],
                        ["Kind", selected.kind],
                        ["Status", selected.status],
                        ...(impact
                          ? ([
                              [
                                "Path edge IDs",
                                <code className="ax-code">
                                  {impact.pathEdgeIds.join(" → ") || "none"}
                                </code>,
                              ],
                            ] as [React.ReactNode, React.ReactNode][])
                          : []),
                      ]}
                    />
                  </TechDetails>
                </div>
              </>
            ) : (
              <p className="ax-muted" id="inspector-title">
                Select a record to inspect its evidence.
              </p>
            )}
          </aside>
        </div>
      </section>
      <section className="ax-panel" aria-labelledby="list-title">
        <div className="ax-panel__head">
          <div>
            <h2 id="list-title">Evidence list</h2>
            <p className="ax-panel__desc">
              The same records as the map, in reading order. Select one to
              inspect it.
            </p>
          </div>
        </div>
        <ul className="ax-evidence-list">
          {visible.map((n) => {
            const record = impactByNode.get(n.id);
            return (
              <li key={n.id}>
                <button
                  className="ax-evidence-item"
                  onClick={() => selectNode(n.id)}
                  aria-pressed={selected?.id === n.id}
                >
                  <span
                    className={`ax-evidence-mark ax-evidence-mark--${n.status.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <span className="ax-evidence-item__label">{n.label}</span>
                  <span className="ax-evidence-item__meta">
                    {n.id === rootId
                      ? "The change"
                      : (nodeKindCopy[n.kind] ?? n.kind)}
                    {" · "}
                    {evidenceCopy[n.status as EvidenceStatus].label}
                    {record &&
                      ` · ${record.direct ? "direct" : "transitive"} impact`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <TechDetails label="Snapshot technical details">
        <KeyValues
          compact
          items={[
            [
              "Snapshot ID",
              <code className="ax-code">{graph.snapshotId}</code>,
            ],
            ["Mode", graph.mode],
            ["Captured", graph.createdAt],
            ["Expires", graph.expiresAt],
            ["Depth limit", graph.limits.maxDepth],
            ["Record limit", graph.limits.maxNodes],
            ["Truncated", graph.truncated ? "yes" : "no"],
          ]}
        />
        <p className="ax-muted ax-small">
          Snapshot freshness is not per-relationship freshness.
        </p>
      </TechDetails>
    </>
  );
}
