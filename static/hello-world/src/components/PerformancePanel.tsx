import React from "react";
import Icon from "./Icon";
import { TechDetails } from "./ui";
import { useTimings, type Timing } from "../app/perf";
import { download } from "../app/workflow";

function summarize(entries: Timing[]) {
  const byOp = new Map<string, number[]>();
  let failures = 0;
  for (const e of entries)
    if (e.kind === "request") {
      byOp.set(e.name, [...(byOp.get(e.name) ?? []), e.ms]);
      if (!e.ok) failures++;
    }
  const requests = [...byOp].map(([name, ms]) => {
    const sorted = [...ms].sort((a, b) => a - b);
    return {
      name,
      count: ms.length,
      median: sorted[Math.floor((sorted.length - 1) / 2)],
      max: sorted[sorted.length - 1],
    };
  });
  return { requests, failures };
}

/** Real timings measured in this browser session; collapsed by default. */
export default function PerformancePanel() {
  const entries = useTimings();
  const milestones = entries.filter((e) => e.kind === "milestone");
  const renders = entries.filter((e) => e.kind === "render");
  const { requests, failures } = summarize(entries);
  return (
    <TechDetails label="Performance in this session">
      <p className="ax-small ax-muted">
        Measured in your browser for this session only; nothing is sent
        anywhere. Milestones count from the moment this app frame started
        loading, so inside Jira they exclude Jira&apos;s own page load. Backend
        times include Forge and Jira latency.
      </p>
      <div
        className="ax-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Session timings"
      >
        <table className="ax-table ax-table--perf">
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Time</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <tr key={`m-${m.name}`}>
                <th scope="row">{m.name}</th>
                <td>{m.ms} ms</td>
                <td>after frame start</td>
              </tr>
            ))}
            {renders.slice(-3).map((r, i) => (
              <tr key={`r-${i}`}>
                <th scope="row">{r.name}</th>
                <td>{r.ms} ms</td>
                <td>{r.detail}</td>
              </tr>
            ))}
            {requests.map((r) => (
              <tr key={`q-${r.name}`}>
                <th scope="row">
                  <code className="ax-code">{r.name}</code>
                </th>
                <td>
                  {r.median} ms{r.count > 1 ? " median" : ""}
                </td>
                <td>
                  {r.count} call{r.count === 1 ? "" : "s"}
                  {r.count > 1 ? `, slowest ${r.max} ms` : ""}
                </td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={3}>No measurements yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {failures > 0 && (
        <p className="ax-small">
          {failures} request{failures === 1 ? "" : "s"} did not complete
          successfully; their time is included.
        </p>
      )}
      <button
        type="button"
        className="ax-btn ax-btn--ghost ax-mt-s"
        disabled={!entries.length}
        onClick={() =>
          download("anticipate-session-timings.json", {
            measuredAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            viewport: `${innerWidth}x${innerHeight}`,
            entries,
          })
        }
      >
        <Icon name="download" size={15} />
        Download timings JSON
      </button>
    </TechDetails>
  );
}
