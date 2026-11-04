// Workflow state and CORE operations for the hosted workspace.
// Ported from the verified workspace including evidence drift and sample setup; preserves validation,
// idempotency, recovery or mutation guards. Presentation lives in src/features.
import { useEffect, useRef, useState } from "react";
import type {
  JiraIssueSummary,
  GraphSnapshot,
  ScenarioComparison,
  PreventionPlan,
} from "@anticipate/contracts";
import { ForgeClient, CoreClientError } from "../api/ForgeClient";
import { usePage } from "../usePage";
import type { OperationFailure } from "../CoreOperationError";
import {
  pages,
  simulationRequest,
  hasExecutionAttempt,
  rememberExecution,
  rememberPlan,
  download,
  type ChangeKind,
} from "./workflow";
import { useBootstrap } from "./useBootstrap";
import { usePlanState } from "./usePlan";
import { assertSnapshotFresh, useExpired } from "./useExpiry";
import { isPlanStale } from "./planGuards";

export { useExpired } from "./useExpiry";

export function useCoreWorkflow(client: ForgeClient) {
  const [page, setPage] = usePage(pages);
  const [projectId, setProjectId] = useState("");
  const {
    resource,
    capabilities,
    allowed,
    requireOperation,
    upgradeSupported,
    projects,
    setProjects,
    projectCursor,
    setProjectCursor,
  } = useBootstrap(client);
  const [candidates, setCandidates] = useState<JiraIssueSummary[] | null>(null);
  const [candidateCursor, setCandidateCursor] = useState<string | null>(null);
  const [rootIssueKey, setRootIssueKey] = useState("");
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [replacement, setReplacement] = useState("");
  const [requestedKind, setRequestedKind] = useState<ChangeKind>("retire");
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [scenarioId, setScenarioId] = useState("");
  const {
    plan,
    setPlan,
    selected,
    setSelected,
    passport,
    setPassport,
    records,
    setRecords,
    recoveryId,
    setRecoveryId,
    attempted,
    setAttempted,
    approvalUncertain,
    setApprovalUncertain,
    confirmation,
    setConfirmation,
    evidenceFailure,
    setEvidenceFailure,
    clearPlan,
    approvedIds,
  } = usePlanState();
  const [operationBusy, setBusy] = useState("");
  // Set only when the backend itself answered with a definitive refusal (error envelope with a requestId):
  // the server checks every execution gate before any Jira write, so nothing was executed.
  const [executionRefusal, setExecutionRefusal] = useState<string | null>(null);
  useEffect(() => setExecutionRefusal(null), [plan?.planId]);
  const [sampleBusy, setSampleBusy] = useState(false);
  const busy =
    operationBusy || (sampleBusy ? "Preparing Jira sample data…" : "");
  const [sampleReplacement, setSampleReplacement] = useState("");
  const [error, setError] = useState<OperationFailure | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const changeKind: ChangeKind =
    requestedKind === "upgrade" && !upgradeSupported ? "retire" : requestedKind;
  const expired = useExpired(snapshot?.expiresAt);
  function fresh() {
    assertSnapshotFresh(snapshot);
  }
  function go(next: string) {
    setPage(next);
    location.hash = encodeURIComponent(next);
    document.getElementById("main")?.focus();
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
    mutation = false,
  ) {
    if (pending.current || sampleBusy) return;
    pending.current = true;
    setBusy(label);
    setError(null);
    setNotice("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      await task(abort.signal);
    } catch (e) {
      if (active.current && !abort.signal.aborted) {
        const failure: OperationFailure = {
          message:
            e instanceof Error
              ? e.message
              : "Operation failed. No success assumed.",
          code: e instanceof CoreClientError ? e.code : "UNEXPECTED",
          retryable: e instanceof CoreClientError && e.retryable,
          mutation,
          details: e instanceof CoreClientError ? e.details : undefined,
        };
        setError(failure);
        if (e instanceof CoreClientError && e.code === "EVIDENCE_CHANGED") {
          setEvidenceFailure(failure);
          setPlan((current) =>
            current ? { ...current, status: "EVIDENCE_CHANGED" } : current,
          );
          setSelected([]);
          setConfirmation(null);
        }
      }
    } finally {
      if (active.current && !abort.signal.aborted) {
        pending.current = false;
        setBusy("");
      }
    }
  }
  async function readSnapshot(
    signal: AbortSignal,
    rootKey = rootIssueKey,
    preferredReplacement = sampleReplacement,
  ) {
    requireOperation("getGraphSnapshot");
    requireOperation("getEvidenceGraph");
    clearSnapshot();
    const selectedProject = projects.find(
      (project) => project.id === projectId,
    );
    if (!selectedProject || !rootKey.startsWith(`${selectedProject.key}-`))
      throw new CoreClientError(
        "VALIDATION",
        "Choose an issue from the selected Jira project, or select its project first.",
      );
    const created = await client.request(
      "getGraphSnapshot",
      {
        projectId,
        rootIssueKey: rootKey,
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
    if (!graph.nodes.some((n) => n.id === `issue:${rootKey}`))
      throw new CoreClientError(
        "INVALID_RESPONSE",
        "Root issue is absent from the graph.",
      );
    setSnapshot(graph);
    setReplacement(
      preferredReplacement &&
        graph.nodes.some((n) => n.id === `issue:${preferredReplacement}`)
        ? `issue:${preferredReplacement}`
        : "",
    );
    go("Evidence Graph");
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
  const writesAvailable = capabilities?.jiraWrite === "AVAILABLE";
  const executionMarked = plan ? hasExecutionAttempt(plan.planId) : false;
  const canExecute =
    !!plan &&
    !!snapshot &&
    snapshot.snapshotId === plan.snapshotId &&
    !executionMarked &&
    plan.status === "APPROVED" &&
    !!passport &&
    passport.plan?.planHash === plan.planHash &&
    approvedIds.size > 0 &&
    !expired &&
    !attempted &&
    !approvalUncertain &&
    !evidenceFailure &&
    writesAvailable &&
    allowed("executeApprovedPlan") &&
    allowed("getExecutionStatus") &&
    allowed("getPreventionPassport");
  const canSelectActions =
    !!plan &&
    !busy &&
    !isPlanStale(plan?.status) &&
    !expired &&
    !!snapshot &&
    !approvalUncertain &&
    !evidenceFailure &&
    !attempted &&
    ["PENDING_APPROVAL", "APPROVED"].includes(plan.status);
  const canApprove =
    !busy &&
    !isPlanStale(plan?.status) &&
    !expired &&
    !!snapshot &&
    !!selected.length &&
    !approvalUncertain &&
    !evidenceFailure &&
    !attempted &&
    writesAvailable &&
    allowed("approvePlan") &&
    allowed("getExecutionStatus") &&
    allowed("getPreventionPassport");

  async function confirmMutation(kind: "approve" | "execute") {
    setConfirmation(null);
    if (!plan || isPlanStale(plan.status) || evidenceFailure) return;
    await run(
      kind === "approve"
        ? "Recording approval…"
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
          setExecutionRefusal(null);
          let status;
          try {
            status = await client.request(
              "executeApprovedPlan",
              { planId: plan.planId, idempotencyKey: executionKey },
              signal,
            );
          } catch (e) {
            if (isDefinitiveRefusal(e)) setExecutionRefusal(e.message);
            throw e;
          }
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
      true,
    );
  }

  const actions = {
    go,
    retryBootstrap: resource.retry,
    dismissError: () => setError(null),
    selectProject(id: string) {
      setProjectId(id);
      setSampleReplacement("");
      setCandidates(null);
      setCandidateCursor(null);
      setRootIssueKey("");
      clearSnapshot();
    },
    loadMoreProjects() {
      return run("Loading projects…", async (signal) => {
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
          ...new Map([...prev, ...next.items].map((p) => [p.id, p])).values(),
        ]);
        setProjectCursor(next.page.nextCursor);
      });
    },
    loadCandidates() {
      return run("Loading change candidates…", async (signal) => {
        requireOperation("getChangeCandidates");
        const next = await client.request(
          "getChangeCandidates",
          { projectId, cursor: null },
          signal,
        );
        setCandidates(next.items);
        setCandidateCursor(next.page.nextCursor);
      });
    },
    loadMoreCandidates() {
      return run("Loading changes…", async (signal) => {
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
            [...(prev ?? []), ...next.items].map((c) => [c.id, c]),
          ).values(),
        ]);
        setCandidateCursor(next.page.nextCursor);
      });
    },
    chooseCandidate(key: string) {
      setSampleReplacement("");
      setRootIssueKey(key);
      clearSnapshot();
    },
    typeIssueKey(value: string) {
      setSampleReplacement("");
      setRootIssueKey(value.toUpperCase().trim());
      clearSnapshot();
    },
    analyze() {
      return run("Reading dependencies from Jira…", (signal) =>
        readSnapshot(signal),
      );
    },
    analyzeSample(root: string, replacementKey: string | null) {
      setRootIssueKey(root);
      setSampleReplacement(replacementKey ?? "");
      return run("Reading Jira sample snapshot…", (signal) =>
        readSnapshot(signal, root, replacementKey ?? ""),
      );
    },
    rebuildSnapshot() {
      clearSnapshot();
      go("Mission Control");
    },
    checkFreshness() {
      if (!plan) return;
      return run("Checking live Jira evidence…", async (signal) => {
        requireOperation("checkPlanFreshness");
        const drift = await client.request(
          "checkPlanFreshness",
          { planId: plan.planId },
          signal,
        );
        if (drift.snapshotId !== plan.snapshotId)
          throw new CoreClientError(
            "INVALID_RESPONSE",
            "Freshness result belongs to another snapshot.",
          );
        if (!drift.fresh) {
          setEvidenceFailure({
            code: "EVIDENCE_CHANGED",
            message: drift.reason,
            details: drift,
            retryable: false,
            mutation: false,
          });
          setSelected([]);
          setConfirmation(null);
        }
        setNotice(
          `${drift.fresh ? "FRESH" : "CHANGED"} at ${drift.checkedAt}. ${drift.reason} Approval and execution revalidate on the server.`,
        );
      });
    },
    setRecoveryId,
    recover() {
      return run("Recovering plan and status…", async (signal) => {
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
          throw new CoreClientError("INVALID_RESPONSE", "No recoverable plan.");
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
          if (!(e instanceof CoreClientError) || e.code !== "SNAPSHOT_EXPIRED")
            throw e;
          setNotice(
            "Plan audit and status recovered. Snapshot expired; new approvals and execution are disabled.",
          );
        }
        setSampleReplacement("");
        setRootIssueKey(report.change.issueKey ?? "");
        setComparison(report.comparison);
        setScenarioId(report.plan.scenarioId);
        setReplacement("");
        setPlan(report.plan);
        setPassport(report);
        setRecords(status);
        setSelected([]);
        setAttempted(
          status.length > 0 || hasExecutionAttempt(report.plan.planId),
        );
        setApprovalUncertain(false);
        rememberPlan(report.plan.planId);
        go("Prevention Plan");
      });
    },
    chooseChangeKind(kind: ChangeKind) {
      if (kind === changeKind || (kind === "upgrade" && !upgradeSupported))
        return;
      setRequestedKind(kind);
      clearComparison();
    },
    chooseReplacement(id: string) {
      setReplacement(id);
      clearComparison();
    },
    compare() {
      if (!snapshot) return;
      return run("Comparing options…", async (signal) => {
        fresh();
        requireOperation("compareScenarios");
        clearComparison();
        const next = await client.request(
          "compareScenarios",
          simulationRequest(snapshot, rootIssueKey, replacement, changeKind),
          signal,
        );
        setComparison(next);
        setScenarioId(
          next.recommendedScenarioId ?? next.results[0]?.scenarioId ?? "",
        );
      });
    },
    chooseScenario(id: string) {
      if (id === scenarioId) return;
      setScenarioId(id);
      clearPlan();
    },
    generatePlan() {
      return run("Generating prevention plan…", async (signal) => {
        fresh();
        requireOperation("generatePreventionPlan");
        clearPlan();
        const next = await client.request(
          "generatePreventionPlan",
          { snapshotId: comparison!.snapshotId, scenarioId },
          signal,
        );
        setPlan(next);
        setRecoveryId(next.planId);
        rememberPlan(next.planId);
        go("Prevention Plan");
      });
    },
    toggleAction(id: string, checked: boolean) {
      setSelected((prev) =>
        checked ? [...prev, id] : prev.filter((x) => x !== id),
      );
    },
    requestConfirmation: setConfirmation,
    cancelConfirmation: () => setConfirmation(null),
    confirmMutation,
    refreshStatus() {
      if (!plan) return;
      return run("Checking execution status…", async (signal) => {
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
      });
    },
    openPassport() {
      if (!plan) return;
      return run("Loading Prevention Passport…", async (signal) => {
        const report = await readPassport(plan, signal);
        setPassport(report);
        setPlan(report.plan);
        go("Prevention Passport");
      });
    },
    exportSnapshot() {
      if (snapshot)
        download(`ANTICIPATE-${snapshot.snapshotId}.json`, snapshot);
    },
    exportPassport() {
      if (passport)
        download(`ANTICIPATE-${passport.passportId}.json`, passport);
    },
  };

  return {
    client,
    operationBusy,
    setSampleBusy,
    evidenceFailure,
    page,
    resource,
    capabilities,
    allowed,
    projectId,
    projects,
    projectCursor,
    candidates,
    candidateCursor,
    rootIssueKey,
    snapshot,
    replacement,
    changeKind,
    upgradeSupported,
    comparison,
    scenarioId,
    currentResult,
    plan,
    selected,
    passport,
    records,
    recoveryId,
    attempted,
    approvalUncertain,
    executionRefusal,
    executionMarked,
    confirmation,
    busy,
    error,
    notice,
    expired,
    approvedIds,
    writesAvailable,
    canExecute,
    canSelectActions,
    canApprove,
    actions,
  };
}

export type Workflow = ReturnType<typeof useCoreWorkflow>;

/** Backend refusals that are decided before any Jira write (never TIMEOUT, NETWORK_ERROR, INVALID_RESPONSE or INTERNAL). */
const REFUSAL_CODES = new Set([
  "PERMISSION_DENIED",
  "CONFLICT",
  "UNSUPPORTED",
  "EVIDENCE_CHANGED",
  "STALE_APPROVAL",
  "VALIDATION",
  "NOT_FOUND",
]);
export function isDefinitiveRefusal(e: unknown): e is CoreClientError {
  return (
    e instanceof CoreClientError && !!e.requestId && REFUSAL_CODES.has(e.code)
  );
}
