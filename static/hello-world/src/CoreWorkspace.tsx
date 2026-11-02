import React from "react";
import { ForgeClient } from "./api/ForgeClient";
import CoreOperationError from "./CoreOperationError";
import { useCoreWorkflow } from "./app/useCoreWorkflow";
import AppShell from "./app/AppShell";
import Icon from "./components/Icon";
import { Notice, PageHeader, Spinner } from "./components/ui";
import MissionControl from "./features/MissionControl";
import EvidencePage from "./features/EvidencePage";
import ScenarioLab from "./features/ScenarioLab";
import DecisionFirewall from "./features/DecisionFirewall";
import PreventionPlan from "./features/PreventionPlan";
import Passport from "./features/Passport";
import Settings from "./features/Settings";
import { stageFor } from "./app/journey";

export { simulationRequest } from "./app/workflow";

/** Hosted (Forge) workspace. Live CORE 0.2.0 responses only; no fixture fallback. */
export default function CoreWorkspace({
  client,
  theme = "light",
  hostNotice = "",
}: {
  client: ForgeClient;
  theme?: string;
  hostNotice?: string;
}) {
  const w = useCoreWorkflow(client);
  const ready = w.resource.status === "ready";
  return (
    <AppShell w={w} theme={theme}>
      {hostNotice && w.page !== "Settings" && (
        <p className="ax-host-note">
          <Icon name="info" size={13} />
          {hostNotice}
        </p>
      )}
      {!ready ? (
        <>
          <PageHeader
            icon={stageFor(w.page).icon}
            step="Connecting"
            title={w.page}
            lead="ANTICIPATE checks what this installation is allowed to do before showing any data."
          />
          <section className="ax-connect" aria-labelledby="connect-title">
            <h2 id="connect-title">Connect your installed workspace</h2>
            {w.resource.status === "loading" ? (
              <div className="ax-connect__loading" role="status">
                <Spinner />
                <span>Checking backend capabilities…</span>
              </div>
            ) : (
              <div className="ax-error" role="alert">
                <span className="ax-error__icon" aria-hidden="true">
                  <Icon name="plug" size={20} />
                </span>
                <div className="ax-error__body">
                  <h3>Backend connection unavailable</h3>
                  <p className="ax-error__message">
                    {w.resource.status === "error" ? w.resource.error : ""}
                  </p>
                </div>
                <button className="ax-btn" onClick={w.resource.retry}>
                  <Icon name="refresh" size={15} />
                  Retry capability check
                </button>
              </div>
            )}
            <p className="ax-muted">
              Open ANTICIPATE from the authorized Atlassian installation. No
              local demo data is substituted.
            </p>
          </section>
        </>
      ) : (
        <>
          <div className="ax-live" aria-live="polite">
            {w.busy && (
              <p className="ax-busy" role="status">
                <Spinner />
                {w.busy}
              </p>
            )}
          </div>
          {w.error && (
            <CoreOperationError
              failure={w.error}
              onDismiss={w.actions.dismissError}
            />
          )}
          {w.notice && (
            <Notice tone="success" role="status" icon="check">
              {w.notice}
            </Notice>
          )}
          {w.expired && w.page !== "Prevention Plan" && (
            <Notice
              tone="warning"
              role="alert"
              icon="clock"
              title="Snapshot expired"
            >
              Rebuild the snapshot and compare again. Status and Passport
              recovery remain available.
            </Notice>
          )}
          <div className="ax-page" key={w.page}>
            {w.page === "Mission Control" && <MissionControl w={w} />}
            {w.page === "Evidence Graph" && <EvidencePage w={w} />}
            {w.page === "Scenario Lab" && <ScenarioLab w={w} />}
            {w.page === "Decision Firewall" && <DecisionFirewall w={w} />}
            {w.page === "Prevention Plan" && <PreventionPlan w={w} />}
            {w.page === "Prevention Passport" && <Passport w={w} />}
            {w.page === "Settings" && (
              <Settings w={w} theme={theme} hostNotice={hostNotice} />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
