import React, { useMemo, useState } from "react";
import Graph from "./Graph";
import ActionReview from "./ActionReview";
import { FixtureClient } from "./api/FixtureClient";
const fixtureClient = new FixtureClient();
import { type AnticipateClient } from "./api/provisional-contracts";
export default function Showcase() {
  const [preview, setPreview] = useState("ready");
  const client = useMemo<AnticipateClient>(() => {
    let attempts = 0;
    return {
      getCapabilities: () => fixtureClient.getCapabilities(),
      getProjects: () => fixtureClient.getProjects(),
      async request(operation, input, signal) {
        if (operation === "getEvidenceGraph") {
          if (preview === "empty")
            return {
              mode: "fixture",
              snapshotId: "demo-auth-v1-2026-11-02",
              root: { id: "auth", label: "Legacy authentication API v1" },
              services: [],
              edges: [],
            };
          if (preview === "large") {
            const { largeGraph } = await import("./graphFixtures");
            return largeGraph(120);
          }
          if (preview === "retry" && attempts++ === 0)
            throw new Error(
              "Development fixture: snapshot temporarily unavailable",
            );
          if (preview === "slow")
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        return fixtureClient.request(operation, input, signal);
      },
    };
  }, [preview]);
  return (
    <>
      <section className="panel">
        <h2>Component showcase</h2>
        <p>
          Development only. These controls exercise fictional UI states without
          external requests.
        </p>
        <div className="section-heading">
          <button
            className="primary"
            title="Load ready fixture"
            onClick={() => setPreview("ready")}
          >
            Load ready fixture
          </button>
          <button disabled>Unavailable action</button>
          <span className="badge">CONFIRMED</span>
          <span className="badge warning">UNKNOWN</span>
          <span className="badge danger">FAILED</span>
        </div>
        <p>
          Components below use the same graph, resource loader, typography,
          cards, form controls and feedback patterns as the application.
        </p>
        <label>
          Graph resource preview
          <select
            value={preview}
            onChange={(event) => setPreview(event.target.value)}
          >
            <option value="ready">Ready fixture</option>
            <option value="empty">Empty snapshot</option>
            <option value="retry">Fail once, then retry</option>
            <option value="slow">Slow loading snapshot</option>
            <option value="large">120 dependencies with a cycle</option>
          </select>
        </label>
      </section>
      <Graph client={client} />
      <ActionReview
        client={fixtureClient}
        snapshotId="demo-auth-v1-2026-11-02"
      />
    </>
  );
}
