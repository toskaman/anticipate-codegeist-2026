import React, { useMemo, useState } from "react";
import Graph from "./Graph";
import { localAdapter } from "./adapters";
export default function Showcase() {
  const [preview, setPreview] = useState("ready");
  const adapter = useMemo(() => {
    let attempts = 0;
    return {
      ...localAdapter,
      async getEvidenceGraph() {
        if (preview === "empty") return [];
        if (preview === "retry" && attempts++ === 0)
          throw new Error(
            "Development fixture: snapshot temporarily unavailable",
          );
        if (preview === "slow")
          await new Promise((resolve) => setTimeout(resolve, 1500));
        return localAdapter.getEvidenceGraph();
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
          </select>
        </label>
      </section>
      <Graph adapter={adapter} />
    </>
  );
}
