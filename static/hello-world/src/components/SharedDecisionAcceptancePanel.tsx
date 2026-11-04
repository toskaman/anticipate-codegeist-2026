import React, { useCallback, useEffect, useState } from "react";
import type {
  FeatureFlag,
  SharedDecision,
  SharedDecisionAuditEvent,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import { Badge, Notice, Panel } from "./ui";

/**
 * Acceptance-only panel for the shared decision workspace (#131).
 * Renders nothing unless the backend reports `released: true`, which happens only when the
 * release lock is lifted or the development-only Forge variable ANTICIPATE_SHARED_DECISIONS_ACCEPTANCE=true
 * is set. Every action is a plain call to an existing, server-enforced operation; the panel adds no authority.
 */
export default function SharedDecisionAcceptancePanel({
  client,
  currentPlanId,
}: {
  client: ForgeClient;
  currentPlanId: string | null;
}) {
  const [flag, setFlag] = useState<FeatureFlag | null>(null);
  const [decision, setDecision] = useState<SharedDecision | null>(null);
  const [audit, setAudit] = useState<SharedDecisionAuditEvent[]>([]);
  const [idInput, setIdInput] = useState("");
  const [planInput, setPlanInput] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);

  const loadFlag = useCallback(async () => {
    try {
      setFlag(
        await client.request("getFeatureFlag", { flag: "sharedDecisions" }),
      );
    } catch {
      setFlag(null);
    }
  }, [client]);
  useEffect(() => {
    void loadFlag();
  }, [loadFlag]);
  useEffect(() => {
    if (currentPlanId && !planInput) setPlanInput(currentPlanId);
  }, [currentPlanId, planInput]);

  if (!flag?.released) return null;

  async function run(label: string, fn: () => Promise<SharedDecision | void>) {
    setBusy(true);
    try {
      const d = await fn();
      if (d) {
        setDecision(d);
        setIdInput(d.id);
        try {
          const page = await client.request("listDecisionAudit", {
            id: d.id,
            cursor: null,
            limit: 100,
          });
          setAudit(page.items);
        } catch {
          setAudit([]);
        }
      }
      setLast({ ok: true, text: `${label}: OK` });
    } catch (e) {
      const code = e instanceof CoreClientError ? e.code : "ERROR";
      const why =
        e instanceof CoreClientError && e.details?.reason
          ? ` (${String(e.details.reason)})`
          : "";
      setLast({
        ok: false,
        text: `${label}: refused ${code}${why} — ${e instanceof Error ? e.message : ""}`,
      });
    } finally {
      setBusy(false);
    }
  }
  const id = idInput.trim();

  return (
    <Panel
      title="Acceptance: shared decisions"
      id="shared-acceptance-title"
      description="Development acceptance only. Visible because this environment has the acceptance unlock. Every action is checked by the server."
    >
      <p data-testid="sa-flag">
        Feature flag:{" "}
        <Badge tone={flag.enabled ? "success" : "neutral"}>
          {flag.enabled ? "enabled" : "disabled"}
        </Badge>
        {flag.canEdit && (
          <button
            className="ax-btn"
            disabled={busy}
            onClick={() =>
              void run(flag.enabled ? "Disable" : "Enable", async () => {
                setFlag(
                  await client.request("setFeatureFlag", {
                    flag: "sharedDecisions",
                    enabled: !flag.enabled,
                  }),
                );
              })
            }
          >
            {flag.enabled ? "Disable" : "Enable"}
          </button>
        )}
      </p>

      <label>
        Plan id{" "}
        <input
          data-testid="sa-plan"
          value={planInput}
          onChange={(e) => setPlanInput(e.target.value)}
        />
      </label>
      <button
        className="ax-btn"
        data-testid="sa-share"
        disabled={busy || !planInput.trim()}
        onClick={() =>
          void run("Share", () =>
            client.request("shareDecision", {
              planId: planInput.trim(),
              requiredApprovals: 1,
            }),
          )
        }
      >
        Share plan
      </button>

      <div>
        <label>
          Decision id{" "}
          <input
            data-testid="sa-id"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
        </label>
        <button
          className="ax-btn"
          data-testid="sa-load"
          disabled={busy || !id}
          onClick={() =>
            void run("Load", () => client.request("getSharedDecision", { id }))
          }
        >
          Load
        </button>
      </div>

      <label>
        Reason{" "}
        <input
          data-testid="sa-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div>
        <button
          className="ax-btn"
          data-testid="sa-approve"
          disabled={busy || !decision}
          onClick={() =>
            void run("Approve", () =>
              client.request("approveSharedDecision", {
                id: decision!.id,
                planHash: decision!.planHash,
              }),
            )
          }
        >
          Approve
        </button>
        <button
          className="ax-btn"
          data-testid="sa-reject"
          disabled={busy || !decision || !reason.trim()}
          onClick={() =>
            void run("Reject", () =>
              client.request("rejectSharedDecision", {
                id: decision!.id,
                reason: reason.trim(),
              }),
            )
          }
        >
          Reject
        </button>
        <button
          className="ax-btn"
          data-testid="sa-revoke"
          disabled={busy || !decision || !reason.trim()}
          onClick={() =>
            void run("Revoke", () =>
              client.request("revokeSharedDecision", {
                id: decision!.id,
                reason: reason.trim(),
              }),
            )
          }
        >
          Revoke
        </button>
      </div>

      {last && (
        <Notice
          tone={last.ok ? "success" : "warning"}
          icon={last.ok ? "check" : "alert"}
          title="Last action"
        >
          <p data-testid="sa-last">{last.text}</p>
        </Notice>
      )}
      {decision && (
        <pre
          data-testid="sa-decision"
          style={{ whiteSpace: "pre-wrap", fontSize: 12 }}
        >
          {JSON.stringify(
            {
              id: decision.id,
              state: decision.state,
              planId: decision.planId,
              planHash: decision.planHash,
              proposer: decision.proposer,
              approvals: decision.approvals,
              waitingFor: decision.waitingFor,
              evidenceChanged: decision.evidenceChanged,
              expiresAt: decision.expiresAt,
              closed: decision.closed,
              capabilities: decision.capabilities,
            },
            null,
            2,
          )}
        </pre>
      )}
      {audit.length > 0 && (
        <ol data-testid="sa-audit">
          {audit.map((a) => (
            <li key={a.id}>
              {a.at} {a.event} by {a.by}
              {a.detail ? ` — ${a.detail}` : ""}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
