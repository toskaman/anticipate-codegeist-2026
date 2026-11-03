// Plan and passport state extracted from useCoreWorkflow: reviewed decision,
// backend approvals, execution records, and confirmation flow.
import { useState } from "react";
import type {
  ExecutionRecord,
  PreventionPassport,
  PreventionPlan,
} from "@anticipate/contracts";
import type { OperationFailure } from "../CoreOperationError";
import { storedPlan } from "./workflow";

export function usePlanState() {
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
  const [evidenceFailure, setEvidenceFailure] =
    useState<OperationFailure | null>(null);
  function clearPlan() {
    setEvidenceFailure(null);
    setPlan(null);
    setPassport(null);
    setSelected([]);
    setRecords(null);
    setAttempted(false);
    setApprovalUncertain(false);
    setConfirmation(null);
  }
  const approvedIds = new Set(
    passport?.approvals
      .flatMap((a) => a.actionIds)
      .filter((id) => plan?.actions.some((a) => a.actionId === id)) ?? [],
  );
  return {
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
  };
}
