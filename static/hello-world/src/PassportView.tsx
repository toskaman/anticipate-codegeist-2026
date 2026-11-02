import React, { useCallback } from "react";
import {
  type AnticipateClient,
  passportSchema,
} from "./api/provisional-contracts";
import { type ScenarioId } from "./domain";
import { useResource } from "./useResource";
export default function PassportView({
  client,
  snapshotId,
  scenarioId,
}: {
  client: AnticipateClient;
  snapshotId: string;
  scenarioId: ScenarioId;
}) {
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const report = passportSchema.parse(
        await client.request(
          "getPreventionPassport",
          { snapshotId, scenarioId },
          signal,
        ),
      );
      if (
        report.snapshot !== snapshotId ||
        report.selectedScenario !== scenarioId
      )
        throw new Error(
          "Report does not match the selected snapshot and scenario",
        );
      return report;
    },
    [client, snapshotId, scenarioId],
  );
  const resource = useResource(load);
  if (resource.status === "loading")
    return <p role="status">Loading Prevention Passport…</p>;
  if (resource.status === "error")
    return (
      <section className="panel" role="alert">
        <h2>Passport unavailable</h2>
        <p>{resource.error}</p>
        <button onClick={resource.retry}>Retry passport</button>
      </section>
    );
  const report = resource.data;
  function exportReport() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      report.mode === "fixture"
        ? "ANTICIPATE-DEMO-passport.json"
        : "ANTICIPATE-passport.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel passport">
      <span className="eyebrow">
        PREVENTION PASSPORT / {report.mode.toUpperCase()}
      </span>
      <h2>{report.change}</h2>
      <p>{report.disclosure}</p>
      <p>
        Snapshot: {report.snapshot} · Created:{" "}
        {new Date(report.createdAt).toLocaleString("en-GB")}
      </p>
      <h3>Decision record</h3>
      <p>Selected scenario {report.selectedScenario}. Compared A, B and C.</p>
      <p>
        {report.violatedPolicies} policy violations. Execution:{" "}
        {report.execution}.
      </p>
      <h3>Dependencies & evidence</h3>
      {report.affectedDependencies.map((service) => (
        <p key={service.id}>
          {service.label} · {service.evidence} · {service.source}
        </p>
      ))}
      <h3>Mitigations</h3>
      {report.mitigations.map((item) => (
        <p key={item}>→ {item}</p>
      ))}
      <h3>Remaining uncertainty</h3>
      {report.uncertainty.map((item) => (
        <p key={item}>{item}</p>
      ))}
      <h3>Approval timeline</h3>
      {report.approvalTimeline.length ? (
        report.approvalTimeline.map((item, index) => (
          <p key={index}>
            {item.event} · {item.at}
          </p>
        ))
      ) : (
        <p>No authenticated approval or verified execution recorded.</p>
      )}
      {report.mode === "fixture" && (
        <p>
          <strong>
            Fictional demo report. No certification, signature, or real-world
            verification.
          </strong>
        </p>
      )}
      <button className="primary" onClick={exportReport}>
        Export {report.mode === "fixture" ? "demo " : ""}JSON
      </button>
      <button onClick={() => window.print()}>Print report / PDF</button>
    </section>
  );
}
