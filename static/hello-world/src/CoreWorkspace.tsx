import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  CapabilityAvailability,
  ProjectSummary,
  JiraIssueSummary,
  GraphSnapshot,
  ScenarioComparison,
  PreventionPlan,
  PreventionPassport,
  ExecutionRecord,
  SimulationRequest,
  OperationName,
} from "@anticipate/contracts";
import { ForgeClient, CoreClientError } from "./api/ForgeClient";
import { useResource } from "./useResource";
import { usePage } from "./usePage";
import ConfirmDialog from "./ConfirmDialog";
import CoreEvidenceGraph, { SourceLink } from "./CoreEvidenceGraph";

const pages = [
  "Mission Control",
  "Evidence Graph",
  "Scenario Lab",
  "Decision Firewall",
  "Prevention Plan",
  "Prevention Passport",
  "Settings",
];
export function simulationRequest(
  graph: GraphSnapshot,
  rootIssueKey: string,
  replacement: string,
): SimulationRequest {
  const target = `issue:${rootIssueKey}`;
  if (!graph.nodes.some((n) => n.id === target))
    throw new CoreClientError(
      "VALIDATION",
      "The root issue is not in this snapshot.",
    );
  if (
    replacement &&
    (replacement === target || !graph.nodes.some((n) => n.id === replacement))
  )
    throw new CoreClientError(
      "VALIDATION",
      "Choose a distinct replacement node from this snapshot.",
    );
  return {
    snapshotId: graph.snapshotId,
    change: {
      issueKey: rootIssueKey,
      targetNodeId: target,
      description: `Review retirement of ${rootIssueKey}`,
    },
    maxDepth: Math.min(10, Math.max(1, graph.limits.maxDepth)),
    scenarios: [
      {
        scenarioId: "A-remove-now",
        label: "Remove now",
        operations: [{ op: "REMOVE_NODE", nodeId: target }],
      },
      {
        scenarioId: "B-retain-temporarily",
        label: "Retain temporarily",
        operations: [
          { op: "DEPRECATE_NODE", nodeId: target, retainUntil: null },
        ],
      },
      ...(replacement
        ? [
            {
              scenarioId: "C-migrate-then-retire",
              label: "Migrate then retire",
              operations: [
                {
                  op: "MIGRATE_DEPENDENTS" as const,
                  fromNodeId: target,
                  toNodeId: replacement,
                  edgeKinds: ["USES" as const, "DEPENDS_ON" as const],
                },
                { op: "REMOVE_NODE" as const, nodeId: target },
              ],
            },
          ]
        : []),
    ],
  };
}
const recoveryStorage = "anticipate-core-plan-id";
function storedPlan() {
  try {
    return sessionStorage.getItem(recoveryStorage) ?? "";
  } catch {
    return "";
  }
}
function hasExecutionAttempt(planId: string) {
  try {
    return !!sessionStorage.getItem(`anticipate-core-execution:${planId}`);
  } catch {
    return true;
  }
}
function rememberExecution(planId: string, key: string) {
  // A failed durable marker prevents the write rather than losing reload recovery.
  sessionStorage.setItem(`anticipate-core-execution:${planId}`, key);
}
function rememberPlan(planId: string) {
  try {
    sessionStorage.setItem(recoveryStorage, planId);
  } catch {
    /* Status can still be recovered using the visible plan ID. */
  }
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function CoreWorkspace({
  client,
  theme = "light",
  hostNotice = "",
}: {
  client: ForgeClient;
  theme?: string;
  hostNotice?: string;
}) {
  const [page, setPage] = usePage(pages);
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectCursor, setProjectCursor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<JiraIssueSummary[] | null>(null);
  const [candidateCursor, setCandidateCursor] = useState<string | null>(null);
  const [rootIssueKey, setRootIssueKey] = useState("");
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [replacement, setReplacement] = useState("");
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [scenarioId, setScenarioId] = useState("");
  const [plan, setPlan] = useState<PreventionPlan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [passport, setPassport] = useState<PreventionPassport | null>(null);
  const [records, setRecords] = useState<ExecutionRecord[] | null>(null);
  const [recoveryId, setRecoveryId] = useState(storedPlan);
  const [attempted, setAttempted] = useState(false);
  const [approvalUncertain, setApprovalUncertain] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "approve" | "execute" | null
  >(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active.current = false;
      controller.current?.abort();
      clearInterval(clock);
    };
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const capabilities = await client.request("getCapabilities", {}, signal);
      const available =
        capabilities.jiraRead === "AVAILABLE" &&
        capabilities.operations.includes("listProjects");
      const first = available
        ? await client.request("listProjects", { cursor: null }, signal)
        : null;
      return { capabilities, first };
    },
    [client],
  );
  const resource = useResource(load);
  const bootstrap = resource.status === "ready" ? resource.data : null;
  useEffect(() => {
    if (bootstrap) {
      setProjects(bootstrap.first?.items ?? []);
      setProjectCursor(bootstrap.first?.page.nextCursor ?? null);
    }
  }, [bootstrap]);
  const capabilities: CapabilityAvailability | null =
    resource.status === "ready" ? resource.data.capabilities : null;
  const allowed = (op: OperationName) =>
    capabilities?.operations.includes(op) ?? false;
  const expired = snapshot ? Date.parse(snapshot.expiresAt) <= now : false;
  function fresh() {
    if (!snapshot || Date.parse(snapshot.expiresAt) <= Date.now())
      throw new CoreClientError(
        "SNAPSHOT_EXPIRED",
        "Reload a snapshot and compare scenarios before reviewing a new plan.",
      );
  }
  function requireOperation(op: OperationName) {
    if (!allowed(op))
      throw new CoreClientError(
        "UNSUPPORTED",
        `${op} is not enabled by the backend.`,
      );
  }
  function go(next: string) {
    setPage(next);
    location.hash = encodeURIComponent(next);
    document.getElementById("main")?.focus();
  }
  function clearPlan() {
    setPlan(null);
    setPassport(null);
    setSelected([]);
    setRecords(null);
    setAttempted(false);
    setApprovalUncertain(false);
    setConfirmation(null);
  }
  function clearComparison() {
    setComparison(null);
    setScenarioId("");
    clearPlan();
  }
  function clearSnapshot() {
    setSnapshot(null);
    setReplacement("");
    clearComparison();
  }
  async function run(
    label: string,
    task: (signal: AbortSignal) => Promise<void>,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      await task(abort.signal);
    } catch (e) {
      if (active.current && !abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Operation failed. No success assumed.",
        );
    } finally {
      if (active.current && !abort.signal.aborted) {
        pending.current = false;
        setBusy("");
      }
    }
  }
  async function readPassport(
    currentPlan: PreventionPlan,
    signal: AbortSignal,
  ) {
    requireOperation("getPreventionPassport");
    const report = await client.request(
      "getPreventionPassport",
      { planId: currentPlan.planId },
      signal,
    );
    if (
      report.snapshotId !== currentPlan.snapshotId ||
      report.plan?.scenarioId !== currentPlan.scenarioId ||
      report.plan.planHash !== currentPlan.planHash
    )
      throw new CoreClientError(
        "INVALID_RESPONSE",
        "Passport differs from the reviewed decision.",
      );
    return report;
  }
  const currentResult = comparison?.results.find(
    (r) => r.scenarioId === scenarioId,
  );
  const approvedIds = new Set(
    passport?.approvals
      .flatMap((a) => a.actionIds)
      .filter((id) => plan?.actions.some((a) => a.actionId === id)) ?? [],
  );
  const writesAvailable = capabilities?.jiraWrite === "AVAILABLE";
  const canExecute =
    !!plan &&
    !!snapshot &&
    snapshot.snapshotId === plan.snapshotId &&
    !hasExecutionAttempt(plan.planId) &&
    plan.status === "APPROVED" &&
    !!passport &&
    passport.plan?.planHash === plan.planHash &&
    approvedIds.size > 0 &&
    !expired &&
    !attempted &&
    !approvalUncertain &&
    writesAvailable &&
    allowed("executeApprovedPlan") &&
    allowed("getExecutionStatus") &&
    allowed("getPreventionPassport");
  async function confirmMutation(kind: "approve" | "execute") {
    setConfirmation(null);
    if (!plan) return;
    await run(
      kind === "approve"
        ? "Requesting approval…"
        : "Executing approved Jira actions…",
      async (signal) => {
        fresh();
        if (!writesAvailable)
          throw new CoreClientError(
            "PERMISSION_DENIED",
            "Jira writes are unavailable for this workspace.",
          );
        if (kind === "approve") {
          requireOperation("approvePlan");
          if (!selected.length || approvalUncertain) return;
          setApprovalUncertain(true);
          const updated = await client.request(
            "approvePlan",
            {
              planId: plan.planId,
              planHash: plan.planHash,
              approvedActionIds: selected,
              idempotencyKey: crypto.randomUUID(),
            },
            signal,
          );
          if (
            updated.snapshotId !== plan.snapshotId ||
            updated.scenarioId !== plan.scenarioId
          )
            throw new CoreClientError(
              "INVALID_RESPONSE",
              "Approval belongs to another decision.",
            );
          setPlan(updated);
          setSelected([]);
          const report = await readPassport(updated, signal);
          if (
            report.plan?.status !== "APPROVED" ||
            selected.some(
              (id) => !report.approvals.some((a) => a.actionIds.includes(id)),
            )
          )
            throw new CoreClientError(
              "INVALID_RESPONSE",
              "Selected approvals were not recorded in the backend audit.",
            );
          setPassport(report);
          setApprovalUncertain(false);
          setNotice("Backend approval recorded. No execution was requested.");
        } else {
          requireOperation("executeApprovedPlan");
          if (!canExecute) return;
          // Mark before invoke: timeouts/invalid replies never unlock another write.
          setAttempted(true);
          const executionKey = crypto.randomUUID();
          rememberExecution(plan.planId, executionKey);
          const status = await client.request(
            "executeApprovedPlan",
            { planId: plan.planId, idempotencyKey: executionKey },
            signal,
          );
          if (status.some((r) => !approvedIds.has(r.actionId)))
            throw new CoreClientError(
              "INVALID_RESPONSE",
              "Execution returned an action outside the backend approval record.",
            );
          setRecords(status);
          const report = await readPassport(plan, signal);
          setPassport(report);
          setPlan(report.plan);
          setNotice(
            "Backend execution records received. Only VERIFIED actions are verified outcomes.",
          );
        }
      },
    );
  }
  const bootstrapFailed = resource.status !== "ready";
  return (
    <div className="app core-workspace" data-theme={theme}>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside>
        <div className="brand">
          ANTICIPATE<small>CORE · LIVE WORKSPACE</small>
        </div>
        <nav aria-label="Workspace screens">
          {pages.map((name) => (
            <button
              key={name}
              disabled={!!busy}
              aria-current={page === name ? "page" : undefined}
              onClick={() => go(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <p className="side-note">
          Jira actions require explicit backend approval and a separate
          execution confirmation.
        </p>
      </aside>
      <div className="workspace">
        <header>
          <span>ANTICIPATE / {page}</span>
          <span className="badge">CORE 0.2.0 · LIVE RESPONSES ONLY</span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="title-row">
            <div>
              <p className="eyebrow">ANTICIPATE / CONNECTED EXPERIENCE</p>
              <h1>{page}</h1>
              <p>Test the consequences. Prove the safeguards. Then ship.</p>
            </div>
          </div>
          {hostNotice && <p className="muted">{hostNotice}</p>}
          {bootstrapFailed ? (
            <section className="panel">
              <h2>Connect your installed workspace</h2>
              {resource.status === "loading" ? (
                <p role="status">Checking backend capabilities…</p>
              ) : (
                <div role="alert">
                  <h3>Backend connection unavailable</h3>
                  <p>{resource.error}</p>
                  <button onClick={resource.retry}>
                    Retry capability check
                  </button>
                </div>
              )}
              <p>
                Open ANTICIPATE from the authorized Atlassian installation. No
                local demo data is substituted.
              </p>
            </section>
          ) : (
            <>
              {busy && <p role="status">{busy}</p>}
              {error && (
                <div className="panel" role="alert">
                  {error}
                  <p>
                    Mutation responses can be uncertain. Recover status using
                    the plan ID before any new write.
                  </p>
                </div>
              )}
              {notice && <p role="status">{notice}</p>}
              {expired && (
                <p role="alert">
                  Snapshot expired. Rebuild the snapshot and compare again.
                  Status and Passport recovery remain available.
                </p>
              )}
              {page === "Mission Control" && (
                <>
                  <section className="panel">
                    <h2>Choose a Jira change</h2>
                    {resource.data.first === null && (
                      <p role="alert">
                        Jira read capability: {capabilities?.jiraRead}. Project
                        listing is not enabled.
                      </p>
                    )}
                    {resource.data.first && !projects.length && (
                      <p>
                        No projects available. Check Jira project access; no
                        demonstration project is inserted.
                      </p>
                    )}
                    <fieldset disabled={!!busy}>
                      <legend>Project and change</legend>
                      <label>
                        Jira project
                        <select
                          value={projectId}
                          onChange={(e) => {
                            setProjectId(e.target.value);
                            setCandidates(null);
                            setCandidateCursor(null);
                            setRootIssueKey("");
                            clearSnapshot();
                          }}
                        >
                          {<option value="">Choose a project</option>}
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.key} · {p.name} · {p.dataAvailability}
                            </option>
                          ))}
                        </select>
                      </label>
                      {projectCursor && (
                        <button
                          onClick={() =>
                            run("Loading projects…", async (signal) => {
                              requireOperation("listProjects");
                              const next = await client.request(
                                "listProjects",
                                { cursor: projectCursor },
                                signal,
                              );
                              if (next.page.nextCursor === projectCursor)
                                throw new CoreClientError(
                                  "INVALID_RESPONSE",
                                  "Project cursor did not advance.",
                                );
                              setProjects((prev) => [
                                ...new Map(
                                  [...prev, ...next.items].map((p) => [
                                    p.id,
                                    p,
                                  ]),
                                ).values(),
                              ]);
                              setProjectCursor(next.page.nextCursor);
                            })
                          }
                        >
                          Load more projects
                        </button>
                      )}
                      <button
                        disabled={!projectId || !allowed("getChangeCandidates")}
                        onClick={() =>
                          run("Loading change candidates…", async (signal) => {
                            requireOperation("getChangeCandidates");
                            const next = await client.request(
                              "getChangeCandidates",
                              { projectId, cursor: null },
                              signal,
                            );
                            setCandidates(next.items);
                            setCandidateCursor(next.page.nextCursor);
                          })
                        }
                      >
                        Load change candidates
                      </button>
                      {candidates?.length === 0 && (
                        <p>
                          No issues labelled anticipate-change. Enter an
                          accessible issue key below.
                        </p>
                      )}
                      {!!candidates?.length && (
                        <label>
                          Change candidate
                          <select
                            value={
                              candidates.some((c) => c.key === rootIssueKey)
                                ? rootIssueKey
                                : ""
                            }
                            onChange={(e) => {
                              setRootIssueKey(e.target.value);
                              clearSnapshot();
                            }}
                          >
                            <option value="">Choose a change</option>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.key}>
                                {c.key} · {c.summary}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {candidateCursor && (
                        <button
                          onClick={() =>
                            run("Loading changes…", async (signal) => {
                              const next = await client.request(
                                "getChangeCandidates",
                                { projectId, cursor: candidateCursor },
                                signal,
                              );
                              if (next.page.nextCursor === candidateCursor)
                                throw new CoreClientError(
                                  "INVALID_RESPONSE",
                                  "Change cursor did not advance.",
                                );
                              setCandidates((prev) => [
                                ...new Map(
                                  [...(prev ?? []), ...next.items].map((c) => [
                                    c.id,
                                    c,
                                  ]),
                                ).values(),
                              ]);
                              setCandidateCursor(next.page.nextCursor);
                            })
                          }
                        >
                          Load more changes
                        </button>
                      )}
                      <label>
                        Root Jira issue key
                        <input
                          value={rootIssueKey}
                          placeholder="ABC-123"
                          onChange={(e) => {
                            setRootIssueKey(
                              e.target.value.toUpperCase().trim(),
                            );
                            clearSnapshot();
                          }}
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={
                          !projectId ||
                          !rootIssueKey ||
                          !allowed("getGraphSnapshot") ||
                          !allowed("getEvidenceGraph")
                        }
                        onClick={() =>
                          run("Reading Jira snapshot…", async (signal) => {
                            requireOperation("getGraphSnapshot");
                            requireOperation("getEvidenceGraph");
                            clearSnapshot();
                            const created = await client.request(
                              "getGraphSnapshot",
                              {
                                projectId,
                                rootIssueKey,
                                source: "JIRA",
                                maxDepth: 3,
                              },
                              signal,
                            );
                            const graph = await client.request(
                              "getEvidenceGraph",
                              { snapshotId: created.snapshotId },
                              signal,
                            );
                            if (
                              !graph.nodes.some(
                                (n) => n.id === `issue:${rootIssueKey}`,
                              )
                            )
                              throw new CoreClientError(
                                "INVALID_RESPONSE",
                                "Root issue is absent from the graph.",
                              );
                            setSnapshot(graph);
                            go("Evidence Graph");
                          })
                        }
                      >
                        Read evidence snapshot
                      </button>
                    </fieldset>
                  </section>
                  <section className="panel">
                    <h2>Recover an existing plan</h2>
                    <p>
                      Use planId after a lost response or page reload. Recovery
                      reads status and audit; it does not execute Jira actions.
                    </p>
                    <label>
                      Recovery plan ID
                      <input
                        disabled={!!busy}
                        value={recoveryId}
                        onChange={(e) => setRecoveryId(e.target.value)}
                      />
                    </label>
                    <button
                      disabled={
                        !!busy ||
                        !recoveryId ||
                        !allowed("getPreventionPassport") ||
                        !allowed("getExecutionStatus")
                      }
                      onClick={() =>
                        run("Recovering plan and status…", async (signal) => {
                          const report = await client.request(
                            "getPreventionPassport",
                            { planId: recoveryId },
                            signal,
                          );
                          const status = await client.request(
                            "getExecutionStatus",
                            { planId: recoveryId },
                            signal,
                          );
                          if (!report.plan)
                            throw new CoreClientError(
                              "INVALID_RESPONSE",
                              "No recoverable plan.",
                            );
                          setSnapshot(null);
                          try {
                            const graph = await client.request(
                              "getEvidenceGraph",
                              { snapshotId: report.snapshotId },
                              signal,
                            );
                            setSnapshot(graph);
                            setProjectId(graph.projectId);
                          } catch (e) {
                            if (
                              !(e instanceof CoreClientError) ||
                              e.code !== "SNAPSHOT_EXPIRED"
                            )
                              throw e;
                            setNotice(
                              "Plan audit and status recovered. Snapshot expired; new approvals and execution are disabled.",
                            );
                          }
                          setRootIssueKey(report.change.issueKey ?? "");
                          setComparison(report.comparison);
                          setScenarioId(report.plan.scenarioId);
                          setReplacement("");
                          setPlan(report.plan);
                          setPassport(report);
                          setRecords(status);
                          setSelected([]);
                          setAttempted(
                            status.length > 0 ||
                              hasExecutionAttempt(report.plan.planId),
                          );
                          setApprovalUncertain(false);
                          rememberPlan(report.plan.planId);
                          go("Prevention Plan");
                        })
                      }
                    >
                      Recover plan and execution status
                    </button>
                  </section>
                </>
              )}
              {page === "Evidence Graph" &&
                (snapshot ? (
                  <>
                    <CoreEvidenceGraph
                      key={snapshot.snapshotId}
                      graph={snapshot}
                      result={currentResult}
                    />
                    <button
                      disabled={!!busy || expired}
                      className="primary"
                      onClick={() => go("Scenario Lab")}
                    >
                      Compare change scenarios
                    </button>
                    <button
                      onClick={() =>
                        download(
                          `ANTICIPATE-${snapshot.snapshotId}.json`,
                          snapshot,
                        )
                      }
                    >
                      Export snapshot JSON
                    </button>
                  </>
                ) : (
                  <p>
                    Choose a Jira change in Mission Control and read its
                    snapshot first.
                  </p>
                ))}
              {page === "Scenario Lab" && (
                <section className="panel">
                  <h2>Deterministic CORE scenarios</h2>
                  {!snapshot ? (
                    <p>Read a Jira snapshot in Mission Control first.</p>
                  ) : (
                    <>
                      <p>
                        Snapshot {snapshot.snapshotId}. A removes the root
                        issue; B deprecates it temporarily. C migrates
                        USES/DEPENDS_ON relationships to a replacement you
                        explicitly select.
                      </p>
                      <label>
                        Replacement node for scenario C
                        <select
                          disabled={!!busy}
                          value={replacement}
                          onChange={(e) => {
                            setReplacement(e.target.value);
                            clearComparison();
                          }}
                        >
                          <option value="">
                            No replacement — compare A and B
                          </option>
                          {snapshot.nodes
                            .filter((n) => n.id !== `issue:${rootIssueKey}`)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label} ({n.kind}, {n.status})
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        className="primary"
                        disabled={
                          !!busy || expired || !allowed("compareScenarios")
                        }
                        onClick={() =>
                          run("Comparing scenarios…", async (signal) => {
                            fresh();
                            requireOperation("compareScenarios");
                            clearComparison();
                            const next = await client.request(
                              "compareScenarios",
                              simulationRequest(
                                snapshot,
                                rootIssueKey,
                                replacement,
                              ),
                              signal,
                            );
                            setComparison(next);
                            setScenarioId(
                              next.recommendedScenarioId ??
                                next.results[0]?.scenarioId ??
                                "",
                            );
                          })
                        }
                      >
                        Run CORE comparison
                      </button>
                      {comparison && (
                        <>
                          <p>
                            {comparison.recommendationReason} Recommendation is
                            not an approval.
                          </p>
                          <label>
                            Selected CORE scenario
                            <select
                              disabled={!!busy}
                              value={scenarioId}
                              onChange={(e) => {
                                setScenarioId(e.target.value);
                                clearPlan();
                              }}
                            >
                              {comparison.results.map((r) => (
                                <option key={r.scenarioId}>
                                  {r.scenarioId}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="scenario-grid">
                            {comparison.results.map((r) => (
                              <article className="panel" key={r.scenarioId}>
                                <h3>{r.scenarioId}</h3>
                                <span className="badge">{r.verdict}</span>
                                <p>
                                  {r.summary.impacted} impacted ·{" "}
                                  {r.summary.direct} direct ·{" "}
                                  {r.summary.transitive} transitive ·{" "}
                                  {r.summary.blockers} blockers ·{" "}
                                  {r.summary.unknowns} unknowns
                                </p>
                                <p>Result hash: {r.resultHash}</p>
                              </article>
                            ))}
                          </div>
                          <button onClick={() => go("Decision Firewall")}>
                            Review CORE policy checks
                          </button>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}
              {page === "Decision Firewall" && (
                <section className="panel">
                  <h2>Policy review · {scenarioId || "no scenario"}</h2>
                  {!currentResult ? (
                    <p>Run a comparison and select a scenario first.</p>
                  ) : (
                    <>
                      <p>
                        CORE verdict: {currentResult.verdict}. Rules enforce
                        ANTICIPATE decisions, not a Jira workflow transition.
                      </p>
                      {currentResult.violations.map((v, i) => (
                        <article className="action" key={i}>
                          <div>
                            <h3>
                              {v.ruleId} · {v.severity}
                            </h3>
                            <p>{v.explanation}</p>
                            <p>Nodes: {v.nodeIds.join(", ")}</p>
                            <p>
                              Evidence path:{" "}
                              {v.pathEdgeIds.join(" → ") || "Not supplied"}
                            </p>
                          </div>
                        </article>
                      ))}
                      {!currentResult.violations.length && (
                        <p>
                          No policy violations reported. Unknowns and approval
                          requirements still apply.
                        </p>
                      )}
                      <h3>Remaining uncertainty</h3>
                      {currentResult.uncertainties.map((u, i) => (
                        <p key={i}>
                          {u.reason}: {u.explanation}
                        </p>
                      ))}
                      {!currentResult.uncertainties.length && (
                        <p>No uncertainties reported by this simulation.</p>
                      )}
                      <button
                        disabled={
                          !!busy ||
                          expired ||
                          !allowed("generatePreventionPlan")
                        }
                        onClick={() =>
                          run("Generating prevention plan…", async (signal) => {
                            fresh();
                            requireOperation("generatePreventionPlan");
                            clearPlan();
                            const next = await client.request(
                              "generatePreventionPlan",
                              {
                                snapshotId: comparison!.snapshotId,
                                scenarioId,
                              },
                              signal,
                            );
                            setPlan(next);
                            setRecoveryId(next.planId);
                            rememberPlan(next.planId);
                            go("Prevention Plan");
                          })
                        }
                      >
                        Generate selected scenario plan
                      </button>
                    </>
                  )}
                </section>
              )}
              {page === "Prevention Plan" && (
                <section className="panel">
                  <h2>Review individual Jira actions</h2>
                  {!plan ? (
                    <p>
                      Generate a plan from the selected scenario in Decision
                      Firewall.
                    </p>
                  ) : (
                    <>
                      <p>
                        Plan ID: {plan.planId} · snapshot {plan.snapshotId} ·
                        scenario {plan.scenarioId}
                      </p>
                      <p>
                        Plan hash: {plan.planHash} · status {plan.status}
                      </p>
                      <p>
                        Execution applies all actions recorded in backend
                        approvals, including prior approved selections. No
                        action executes on navigation or approval.
                      </p>
                      {plan.actions.map((a) => (
                        <article className="action" key={a.actionId}>
                          <input
                            type="checkbox"
                            aria-label={`Approve ${a.actionId}`}
                            disabled={
                              !!busy ||
                              expired ||
                              !snapshot ||
                              approvalUncertain ||
                              attempted ||
                              !["PENDING_APPROVAL", "APPROVED"].includes(
                                plan.status,
                              )
                            }
                            checked={selected.includes(a.actionId)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, a.actionId]
                                  : prev.filter((id) => id !== a.actionId),
                              )
                            }
                          />
                          <div>
                            <h3>
                              {a.actionId} · {a.type}
                            </h3>
                            <p>
                              Target: {a.targetProjectKey} /{" "}
                              {a.targetIssueKey ?? "new issue"}
                            </p>
                            <p>{a.reason}</p>
                            <p>Permission: {a.requiredPermission}</p>
                            <p>Verification: {a.verificationRule}</p>
                            <p>
                              Evidence edges:{" "}
                              {a.evidenceEdgeIds.join(", ") || "None supplied"}
                            </p>
                            <details>
                              <summary>Review exact action payload</summary>
                              <pre>{JSON.stringify(a.payload, null, 2)}</pre>
                            </details>
                            <p>
                              {approvedIds.has(a.actionId)
                                ? "Backend approval recorded"
                                : "Approval not verified in current audit"}
                            </p>
                          </div>
                        </article>
                      ))}
                      <button
                        className="primary"
                        disabled={
                          !!busy ||
                          expired ||
                          !snapshot ||
                          !selected.length ||
                          approvalUncertain ||
                          attempted ||
                          !writesAvailable ||
                          !allowed("approvePlan") ||
                          !allowed("getExecutionStatus") ||
                          !allowed("getPreventionPassport")
                        }
                        onClick={() => setConfirmation("approve")}
                      >
                        Approve selected actions
                      </button>{" "}
                      <button
                        disabled={!!busy || !canExecute}
                        onClick={() => setConfirmation("execute")}
                      >
                        Execute backend-approved Jira actions
                      </button>
                      <p>
                        Backend-approved action IDs:{" "}
                        {[...approvedIds].join(", ") || "None verified"}
                      </p>
                      {(approvalUncertain || attempted) && (
                        <p role="status">
                          A mutation was requested. Refresh status and audit
                          before further decisions. No automatic resubmission.
                        </p>
                      )}
                      <button
                        disabled={
                          !!busy ||
                          !allowed("getExecutionStatus") ||
                          !allowed("getPreventionPassport")
                        }
                        onClick={() =>
                          run(
                            "Reading execution status and audit…",
                            async (signal) => {
                              const status = await client.request(
                                "getExecutionStatus",
                                { planId: plan.planId },
                                signal,
                              );
                              setRecords(status);
                              const report = await readPassport(plan, signal);
                              setPassport(report);
                              setPlan(report.plan);
                              setApprovalUncertain(false);
                              if (status.length) setAttempted(true);
                            },
                          )
                        }
                      >
                        Refresh plan status and audit
                      </button>
                      {records && (
                        <>
                          <h3>Execution records</h3>
                          {!records.length && (
                            <p>
                              No execution records returned. Absence is not
                              proof that an outstanding request has stopped; no
                              automatic retry is offered.
                            </p>
                          )}
                          {records.map((r) => (
                            <p key={r.actionId}>
                              {r.actionId}: {r.status} · attempt {r.attempt}
                              {r.error
                                ? ` · ${r.error.code}: ${r.error.message}`
                                : ""}
                              {r.resultRef && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <SourceLink url={r.resultRef.url}>
                                    {r.resultRef.issueKey ?? "Result reference"}
                                  </SourceLink>
                                </>
                              )}
                            </p>
                          ))}
                        </>
                      )}
                      <button
                        disabled={!!busy || !allowed("getPreventionPassport")}
                        onClick={() =>
                          run(
                            "Loading Prevention Passport…",
                            async (signal) => {
                              const report = await readPassport(plan, signal);
                              setPassport(report);
                              setPlan(report.plan);
                              go("Prevention Passport");
                            },
                          )
                        }
                      >
                        Open CORE Prevention Passport
                      </button>
                    </>
                  )}
                </section>
              )}
              {page === "Prevention Passport" && (
                <section className="panel passport">
                  <h2>CORE Prevention Passport</h2>
                  {!passport ? (
                    <p>
                      Load the Passport for a generated plan in Prevention Plan.
                    </p>
                  ) : (
                    <>
                      <p>{passport.disclaimer}</p>
                      <p>
                        Mode {passport.mode} · snapshot {passport.snapshotId} ·
                        plan {passport.plan?.planId} · scenario{" "}
                        {passport.plan?.scenarioId}
                      </p>
                      <p>{passport.change.description}</p>
                      <h3>Comparisons</h3>
                      {passport.comparison.results.map((r) => (
                        <p key={r.scenarioId}>
                          {r.scenarioId}: {r.verdict} · {r.summary.impacted}{" "}
                          impacted · {r.summary.blockers} blockers ·{" "}
                          {r.summary.unknowns} unknowns
                        </p>
                      ))}
                      <h3>Backend approvals</h3>
                      {!passport.approvals.length && (
                        <p>No authenticated approval recorded.</p>
                      )}
                      {passport.approvals.map((a, i) => (
                        <p key={i}>
                          {a.accountId ?? "No account supplied"} · {a.at} ·{" "}
                          {a.actionIds.join(", ")}
                        </p>
                      ))}
                      <h3>Execution verification</h3>
                      {!passport.executions.length && (
                        <p>No execution records returned.</p>
                      )}
                      {passport.executions.map((r) => (
                        <p key={r.actionId}>
                          {r.actionId}: {r.status} · attempt {r.attempt}
                          {r.error
                            ? ` · ${r.error.code}: ${r.error.message}`
                            : ""}
                        </p>
                      ))}
                      <h3>Open unknowns</h3>
                      {passport.openUnknowns.map((u, i) => (
                        <p key={i}>
                          {u.reason}: {u.explanation}
                        </p>
                      ))}
                      <h3>Timeline</h3>
                      {passport.timeline.map((t, i) => (
                        <p key={i}>
                          {t.at} · {t.event}
                        </p>
                      ))}
                      <button
                        onClick={() =>
                          download(
                            `ANTICIPATE-${passport.passportId}.json`,
                            passport,
                          )
                        }
                      >
                        Export CORE Passport JSON
                      </button>{" "}
                      <button onClick={() => window.print()}>
                        Print CORE Passport / PDF
                      </button>
                    </>
                  )}
                </section>
              )}
              {page === "Settings" && (
                <section className="panel">
                  <h2>Backend capabilities</h2>
                  {capabilities &&
                    Object.entries(capabilities)
                      .filter(([key]) => key !== "operations")
                      .map(([key, value]) => (
                        <p key={key}>
                          {key}: {value}
                        </p>
                      ))}
                  <p>
                    Enabled operations: {capabilities?.operations.join(", ")}
                  </p>
                  <p>
                    Host theme follows Atlassian. Production accepts LIVE
                    envelopes only; demo data and manual credentials are
                    unavailable.
                  </p>
                  <button disabled={!!busy} onClick={resource.retry}>
                    Refresh capabilities
                  </button>
                </section>
              )}
            </>
          )}
          {confirmation && (
            <ConfirmDialog
              title={
                confirmation === "approve"
                  ? "Approve selected Jira actions?"
                  : "Execute all backend-approved Jira actions?"
              }
              description={
                confirmation === "approve"
                  ? `Record approval for ${selected.join(", ")} on plan ${plan?.planId}, hash ${plan?.planHash}. This does not execute Jira writes.`
                  : `This can create issues, links, labels or comments in Jira. Backend-approved IDs: ${[...approvedIds].join(", ")}. Plan ${plan?.planId}.`
              }
              onCancel={() => setConfirmation(null)}
              onConfirm={() => void confirmMutation(confirmation)}
            />
          )}
        </main>
        <footer>
          ANTICIPATE EXPERIENCE · CORE 0.2.0 · Backend authorization is required
          for every action.
        </footer>
      </div>
    </div>
  );
}
