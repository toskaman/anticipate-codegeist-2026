import React, { useCallback, useEffect, useId, useState } from "react";
import type {
  CapabilityAvailability,
  ValidatorPolicy,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import { Badge, Notice, Panel } from "./ui";
import DecisionDialog from "./DecisionDialog";
import { formatTime } from "../app/copy";

/** Backend signal (in `capabilities.operations`) that the outage policy resolvers exist. */
export const OUTAGE_POLICY_CAPABILITY = "validator:outage-policy";

type Mode = ValidatorPolicy["onOutage"];
const modeCopy: Record<Mode, { label: string; effect: string }> = {
  ALLOW: {
    label: "Allow the transition",
    effect:
      "Transitions pass and the degradation is logged. Work is never stopped by an ANTICIPATE outage, but gated changes are not checked during it.",
  },
  BLOCK: {
    label: "Block the transition",
    effect:
      "Gated transitions are refused with a message asking people to retry or contact an administrator. Gated changes stay protected, but those transitions stop while ANTICIPATE is unavailable.",
  },
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; policy: ValidatorPolicy };

/**
 * What the Jira workflow validator does when ANTICIPATE or Jira cannot be read
 * during a transition. Everyone sees the current setting; only site
 * administrators (backend `canEdit`) get the switch, behind a confirmation.
 */
export default function ValidatorPolicyPanel({
  client,
  capabilities,
}: {
  client: ForgeClient;
  capabilities: CapabilityAvailability | null;
}) {
  const supported =
    capabilities?.operations.includes(OUTAGE_POLICY_CAPABILITY) ?? false;
  const [state, setState] = useState<State>({ status: "loading" });
  const [pending, setPending] = useState<Mode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const base = useId();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState({ status: "loading" });
      try {
        const policy = await client.request("getValidatorPolicy", {}, signal);
        if (!signal?.aborted) setState({ status: "ready", policy });
      } catch (e) {
        if (signal?.aborted) return;
        setState({
          status: "error",
          message:
            e instanceof Error
              ? e.message
              : "The outage policy could not be read.",
        });
      }
    },
    [client],
  );
  useEffect(() => {
    if (!supported) return;
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [supported, load]);

  if (!supported) return null;

  async function save(onOutage: Mode) {
    setPending(null);
    setSaving(true);
    setSaveError("");
    try {
      const policy = await client.request("setValidatorPolicy", { onOutage });
      setState({ status: "ready", policy });
    } catch (e) {
      const denied =
        e instanceof CoreClientError && e.code === "PERMISSION_DENIED";
      setSaveError(
        denied
          ? "Only a Jira site administrator can change this setting. Nothing was changed."
          : `The setting was not saved, so the previous one still applies. ${e instanceof Error ? e.message : ""}`.trim(),
      );
      // Re-read so the screen shows what the backend actually holds.
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Workflow validator during an outage"
      id="validator-policy-title"
      description="When a gated Jira transition happens while ANTICIPATE or Jira cannot be read, the validator follows this setting. It only matters on workflows where an administrator added the validator."
    >
      {state.status === "loading" && (
        <p className="ax-muted" role="status">
          Reading the current setting…
        </p>
      )}
      {state.status === "error" && (
        <Notice tone="warning" icon="alert" title="Setting not available">
          <p>
            {state.message} The validator keeps its stored setting; nothing was
            changed.
          </p>
          <button className="ax-btn" onClick={() => void load()}>
            Try again
          </button>
        </Notice>
      )}
      {state.status === "ready" && (
        <>
          <p data-testid="validator-policy-current">
            During an outage:{" "}
            <Badge
              tone={state.policy.onOutage === "BLOCK" ? "warning" : "neutral"}
              icon={state.policy.onOutage === "BLOCK" ? "lock" : "check"}
              size="sm"
            >
              {state.policy.onOutage === "BLOCK" ? "Block" : "Allow"}
            </Badge>{" "}
            <span className="ax-muted ax-small">
              {state.policy.updatedAt
                ? `Changed ${formatTime(state.policy.updatedAt)} by an administrator.`
                : "Default setting, never changed."}
            </span>
          </p>
          <p className="ax-small">{modeCopy[state.policy.onOutage].effect}</p>
          {state.policy.canEdit ? (
            <fieldset className="ax-prefs__group" disabled={saving}>
              <legend>Change the setting (site administrators)</legend>
              <div className="ax-segmented" role="presentation">
                {(["ALLOW", "BLOCK"] as const).map((m) => (
                  <span key={m} className="ax-segmented__item">
                    <input
                      type="radio"
                      id={`${base}-${m}`}
                      name={`${base}-outage`}
                      value={m}
                      checked={state.policy.onOutage === m}
                      onChange={() => setPending(m)}
                    />
                    <label htmlFor={`${base}-${m}`}>
                      {m === "ALLOW" ? "Allow" : "Block"}
                    </label>
                  </span>
                ))}
              </div>
              <p className="ax-prefs__hint">
                {saving
                  ? "Saving…"
                  : "You will be asked to confirm. If even this setting cannot be read, transitions pass, so an outage can never lock every workflow."}
              </p>
            </fieldset>
          ) : (
            <p className="ax-muted ax-small">
              Only a Jira site administrator can change this setting.
            </p>
          )}
          {saveError && (
            <p className="ax-error-text" role="alert">
              {saveError}
            </p>
          )}
        </>
      )}
      {pending && (
        <DecisionDialog
          title={
            pending === "BLOCK"
              ? "Block gated transitions during an outage?"
              : "Allow gated transitions during an outage?"
          }
          icon={pending === "BLOCK" ? "lock" : "shield"}
          tone="accent"
          confirmLabel={
            pending === "BLOCK"
              ? "Block during outages"
              : "Allow during outages"
          }
          onCancel={() => setPending(null)}
          onConfirm={() => void save(pending)}
        >
          <p>{modeCopy[pending].effect}</p>
          <p>
            This applies to every workflow on this site that uses the ANTICIPATE
            validator. It changes no Jira issue.
          </p>
        </DecisionDialog>
      )}
    </Panel>
  );
}
