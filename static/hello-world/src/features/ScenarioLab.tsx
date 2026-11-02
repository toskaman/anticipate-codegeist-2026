import React from "react";
import type { SimulationResult } from "@anticipate/contracts";
import Icon from "../components/Icon";
import {
  Badge,
  EmptyState,
  KeyValues,
  Notice,
  PageHeader,
  Panel,
  TechDetails,
} from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
import {
  evidenceCopy,
  nodeKindCopy,
  plural,
  scenarioCopy,
  scenarioName,
  verdictCopy,
  type EvidenceStatus,
} from "../app/copy";

const order = ["A-remove-now", "B-retain-temporarily", "C-migrate-then-retire"];

function MetricRow({ r }: { r: SimulationResult }) {
  const s = r.summary;
  const cells: [string, number, string][] = [
    ["Affected", s.impacted, "neutral"],
    ["Direct", s.direct, "neutral"],
    ["Transitive", s.transitive, "neutral"],
    ["Blockers", s.blockers, s.blockers ? "danger" : "neutral"],
    ["Unknowns", s.unknowns, s.unknowns ? "warning" : "neutral"],
  ];
  return (
    <dl className="ax-scenario__metrics">
      {cells.map(([k, v, tone]) => (
        <div
          key={k}
          className={`ax-scenario__metric ax-scenario__metric--${tone}`}
        >
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ScenarioLab({ w }: { w: Workflow }) {
  const s = w.snapshot;
  const c = w.comparison;
  const nodeLabel = (id: string) =>
    s?.nodes.find((n) => n.id === id)?.label ?? id;
  const replacementOptions =
    s?.nodes.filter((n) => n.id !== `issue:${w.rootIssueKey}`) ?? [];
  const results = c
    ? [...c.results].sort(
        (a, b) =>
          (order.indexOf(a.scenarioId) + 1 || 99) -
          (order.indexOf(b.scenarioId) + 1 || 99),
      )
    : [];
  const missingC = c && !c.results.some((r) => r.scenarioId === order[2]);
  const selected = w.currentResult;
  return (
    <>
      <PageHeader
        step="Step 3 of 6 · Compare options"
        icon="scenarios"
        title="Scenario Lab"
        lead="Three ways to make the change, simulated on the same snapshot. Deterministic, read-only, and reproducible."
        actions={
          selected && (
            <button
              className="ax-btn ax-btn--primary"
              disabled={!!w.busy}
              onClick={() => w.actions.go("Decision Firewall")}
            >
              Check safeguards
              <Icon name="arrowRight" size={15} />
            </button>
          )
        }
      />
      {!s && !c ? (
        <EmptyState
          icon="scenarios"
          title="Nothing to compare yet"
          action={
            <button
              className="ax-btn ax-btn--primary"
              onClick={() => w.actions.go("Mission Control")}
            >
              Go to Mission Control
            </button>
          }
        >
          Read a Jira snapshot in Mission Control first.
        </EmptyState>
      ) : (
        <>
          {s ? (
            <Panel
              title="Set up the comparison"
              id="setup-title"
              description={
                <>
                  <strong>A</strong> removes the change target now.{" "}
                  <strong>B</strong> deprecates it and keeps it for now.{" "}
                  <strong>C</strong> migrates its users to a replacement you
                  choose, then removes it.
                </>
              }
            >
              <div className="ax-setup">
                <div className="ax-setup__field">
                  <label htmlFor="replacement">Replacement for option C</label>
                  <select
                    id="replacement"
                    disabled={!!w.busy}
                    value={w.replacement}
                    onChange={(e) =>
                      w.actions.chooseReplacement(e.target.value)
                    }
                  >
                    <option value="">
                      No replacement — compare A and B only
                    </option>
                    {replacementOptions.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({nodeKindCopy[n.kind] ?? n.kind},{" "}
                        {evidenceCopy[
                          n.status as EvidenceStatus
                        ].label.toLowerCase()}
                        )
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="ax-btn ax-btn--primary ax-btn--lg"
                  disabled={
                    !!w.busy || w.expired || !w.allowed("compareScenarios")
                  }
                  onClick={() => void w.actions.compare()}
                >
                  <Icon name="scenarios" size={16} />
                  {c ? "Compare again" : "Compare options"}
                </button>
              </div>
            </Panel>
          ) : (
            <Notice tone="neutral" title="Recovered comparison">
              This comparison was recovered from the plan audit. Its snapshot is
              no longer loaded, so options cannot be compared again here.
            </Notice>
          )}
          {c && (
            <>
              {c.recommendedScenarioId ? (
                <Notice
                  tone="info"
                  icon="sparkline"
                  title={`Suggested by the simulation: ${scenarioName(c.recommendedScenarioId)}`}
                >
                  <p>{c.recommendationReason}</p>
                  <p className="ax-small ax-muted">
                    A suggestion is not an approval. You choose the option, and
                    every Jira action still needs your explicit approval.
                  </p>
                </Notice>
              ) : (
                <Notice tone="neutral" title="No option suggested">
                  <p>{c.recommendationReason}</p>
                </Notice>
              )}
              <div
                className="ax-scenarios"
                role="radiogroup"
                aria-label="Decision options"
              >
                {results.map((r) => {
                  const meta = scenarioCopy[r.scenarioId];
                  const v = verdictCopy[r.verdict];
                  const isSelected = r.scenarioId === w.scenarioId;
                  const diff = c.diff.find(
                    (d) => d.scenarioId === r.scenarioId,
                  );
                  return (
                    <article
                      key={r.scenarioId}
                      className={`ax-scenario ax-scenario--${v.tone} ${isSelected ? "is-selected" : ""}`}
                    >
                      <label className="ax-scenario__select">
                        <input
                          type="radio"
                          name="scenario"
                          className="ax-scenario__radio"
                          checked={isSelected}
                          disabled={!!w.busy}
                          onChange={() =>
                            w.actions.chooseScenario(r.scenarioId)
                          }
                        />
                        <span className="ax-scenario__head">
                          <span
                            className="ax-scenario__letter"
                            aria-hidden="true"
                          >
                            {meta?.letter ?? "•"}
                          </span>
                          <span className="ax-scenario__title">
                            {meta?.title ?? r.scenarioId}
                          </span>
                          {c.recommendedScenarioId === r.scenarioId && (
                            <span className="ax-tag">Suggested</span>
                          )}
                        </span>
                        <span className="ax-scenario__does">
                          {meta?.does ?? "Scenario defined by the backend."}
                        </span>
                        <span className="ax-scenario__verdict">
                          <Badge tone={v.tone} size="lg">
                            {v.label}
                          </Badge>
                        </span>
                      </label>
                      <MetricRow r={r} />
                      <div className="ax-scenario__section">
                        <p className="ax-scenario__k">Policies triggered</p>
                        {r.violations.length ? (
                          <ul className="ax-rule-list">
                            {r.violations.map((x, i) => (
                              <li key={i}>
                                <Badge
                                  tone={
                                    x.severity === "BLOCKER"
                                      ? "danger"
                                      : x.severity === "HIGH"
                                        ? "warning"
                                        : "neutral"
                                  }
                                  size="sm"
                                  icon={null}
                                >
                                  {x.severity.toLowerCase()}
                                </Badge>
                                <span>{x.explanation}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ax-muted ax-small">None reported.</p>
                        )}
                      </div>
                      <div className="ax-scenario__section">
                        <p className="ax-scenario__k">Open questions</p>
                        <p className="ax-small">
                          {r.uncertainties.length
                            ? `${plural(r.uncertainties.length, "uncertainty", "uncertainties")} ${r.uncertainties.length === 1 ? "remains" : "remain"}.`
                            : "None reported by this simulation."}
                        </p>
                        {diff &&
                          (diff.onlyImpacted.length > 0 ||
                            diff.onlyViolatedRules.length > 0) && (
                            <p className="ax-small ax-muted">
                              Unique to this option:{" "}
                              {[
                                diff.onlyImpacted.length &&
                                  plural(
                                    diff.onlyImpacted.length,
                                    "affected record",
                                  ),
                                diff.onlyViolatedRules.length &&
                                  plural(
                                    diff.onlyViolatedRules.length,
                                    "triggered rule",
                                  ),
                              ]
                                .filter(Boolean)
                                .join(", ")}
                              .
                            </p>
                          )}
                      </div>
                      <TechDetails>
                        <KeyValues
                          compact
                          items={[
                            [
                              "Scenario ID",
                              <code className="ax-code">{r.scenarioId}</code>,
                            ],
                            [
                              "Result hash",
                              <code className="ax-code">{r.resultHash}</code>,
                            ],
                            [
                              "Rule IDs",
                              r.violations.map((x) => x.ruleId).join(", ") ||
                                "none",
                            ],
                          ]}
                        />
                      </TechDetails>
                    </article>
                  );
                })}
                {missingC && (
                  <article className="ax-scenario ax-scenario--placeholder">
                    <span className="ax-scenario__head">
                      <span className="ax-scenario__letter" aria-hidden="true">
                        C
                      </span>
                      <span className="ax-scenario__title">Migrate first</span>
                    </span>
                    <p className="ax-scenario__does">
                      Not compared. Choose a replacement above and compare again
                      to include this option.
                    </p>
                  </article>
                )}
              </div>
              {selected && (
                <Panel
                  className="ax-focus"
                  id="focus-title"
                  title={`What “${scenarioName(selected.scenarioId)}” changes`}
                  description={verdictCopy[selected.verdict].next}
                  actions={
                    s && (
                      <button
                        className="ax-btn ax-btn--ghost"
                        onClick={() => w.actions.go("Evidence Graph")}
                      >
                        <Icon name="graph" size={15} />
                        Show in dependency map
                      </button>
                    )
                  }
                >
                  {selected.impacts.length ? (
                    <ul className="ax-impacts" aria-label="Affected records">
                      {selected.impacts.map((i) => (
                        <li key={i.nodeId}>
                          <span
                            className={`ax-impact-tag ax-impact-tag--${i.direct ? "direct" : "transitive"}`}
                          >
                            {i.direct ? "Direct" : "Transitive"}
                          </span>
                          <span className="ax-impacts__label">
                            {nodeLabel(i.nodeId)}
                          </span>
                          <span className="ax-impacts__meta">
                            {plural(i.depth, "hop")} · weakest evidence{" "}
                            {evidenceCopy[
                              i.weakestStatus as EvidenceStatus
                            ].label.toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ax-muted">
                      The simulation reported no affected records for this
                      option within the snapshot.
                    </p>
                  )}
                </Panel>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
