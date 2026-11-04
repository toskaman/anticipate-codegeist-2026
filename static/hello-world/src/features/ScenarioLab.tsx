import React from "react";
import type { SimulationResult } from "@anticipate/contracts";
import Icon from "../components/Icon";
import SlipPanel from "./SlipPanel";
import ScenarioDifference from "../components/ScenarioDifference";
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
  changeKindCopy,
  scenarioOrder,
  evidenceCopy,
  nodeKindCopy,
  plural,
  scenarioCopy,
  scenarioName,
  verdictCopy,
  type EvidenceStatus,
} from "../app/copy";

const PortfolioPanel = React.lazy(() => import("./PortfolioPanel"));

const uncertaintyReason: Record<string, string> = {
  UNKNOWN_EDGE: "Unknown relationship",
  INFERRED_ONLY: "Inferred only",
  ACCESS_LIMITED: "Not readable",
  TRUNCATED: "Outside analysis limits",
  MISSING_TEST_EVIDENCE: "No verified test",
};

function ChangeKindPicker({ w }: { w: Workflow }) {
  const kinds = ["retire", "upgrade"] as const;
  return (
    <fieldset className="ax-kind" disabled={!!w.busy}>
      <legend>What kind of change are you planning?</legend>
      <div className="ax-kind__options">
        {kinds.map((k) => {
          const copy = changeKindCopy[k];
          const unavailable = k === "upgrade" && !w.upgradeSupported;
          return (
            <label
              key={k}
              className={`ax-kind__option ${w.changeKind === k ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""}`}
            >
              <input
                type="radio"
                name="change-kind"
                value={k}
                checked={w.changeKind === k}
                disabled={unavailable}
                aria-describedby={`kind-${k}-text`}
                onChange={() => w.actions.chooseChangeKind(k)}
              />
              <span className="ax-kind__body">
                <strong>{copy.title}</strong>
                <span id={`kind-${k}-text`}>
                  {unavailable
                    ? "Not offered by this backend yet. Retirement comparison stays available."
                    : copy.text}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

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
          (scenarioOrder.indexOf(a.scenarioId) + 1 || 99) -
          (scenarioOrder.indexOf(b.scenarioId) + 1 || 99),
      )
    : [];
  const missingC = c && !c.results.some((r) => r.scenarioId.startsWith("C-"));
  const kind = changeKindCopy[w.changeKind];
  const selected = w.currentResult;
  return (
    <>
      <PageHeader
        step="Step 3 of 6 · Compare options"
        icon="scenarios"
        title="Scenario Lab"
        lead="Compare up to three ways to make the change, simulated on the same dependency analysis. Deterministic, read-only and reproducible: nothing changes in Jira."
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
              description={kind.setup}
            >
              <ChangeKindPicker w={w} />
              <div className="ax-setup">
                <div className="ax-setup__field">
                  <label htmlFor="replacement">{kind.replacementLabel}</label>
                  <select
                    id="replacement"
                    disabled={!!w.busy}
                    value={w.replacement}
                    onChange={(e) =>
                      w.actions.chooseReplacement(e.target.value)
                    }
                  >
                    <option value="">{kind.noReplacement}</option>
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
                        {meta?.assumes && (
                          <span className="ax-scenario__assumes">
                            {meta.assumes}
                          </span>
                        )}
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
                        {r.uncertainties.length ? (
                          <ul className="ax-open-questions">
                            {r.uncertainties.slice(0, 3).map((u, i) => (
                              <li key={i}>
                                <Badge tone="warning" size="sm" icon={null}>
                                  {uncertaintyReason[u.reason] ?? u.reason}
                                </Badge>
                                <span>
                                  {u.nodeId
                                    ? nodeLabel(u.nodeId)
                                    : u.explanation}
                                </span>
                              </li>
                            ))}
                            {r.uncertainties.length > 3 && (
                              <li className="ax-muted">
                                {plural(
                                  r.uncertainties.length - 3,
                                  "more open question",
                                )}{" "}
                                on Decision Firewall.
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="ax-small">
                            None reported by this simulation.
                          </p>
                        )}
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
                      <span className="ax-scenario__title">
                        {w.changeKind === "upgrade"
                          ? "Move consumers first"
                          : "Migrate first"}
                      </span>
                    </span>
                    <p className="ax-scenario__does">
                      Not compared. Choose{" "}
                      {w.changeKind === "upgrade"
                        ? "a new-version record"
                        : "a replacement"}{" "}
                      above and compare again to include this option.
                    </p>
                  </article>
                )}
              </div>
              <ScenarioDifference
                key={c.results.map((result) => result.resultHash).join("|")}
                results={results}
                graph={s}
              />
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
                            {i.direct
                              ? "Uses the changed record directly"
                              : "Affected through another record"}{" "}
                            · {plural(i.depth, "hop")} from{" "}
                            {w.rootIssueKey || "the change"} · weakest evidence{" "}
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
      {s &&
        w.capabilities?.portfolioSimulation === "AVAILABLE" &&
        w.capabilities.operations.includes("simulatePortfolio") && (
          <React.Suspense
            fallback={<p role="status">Loading portfolio tools…</p>}
          >
            <PortfolioPanel w={w} />
          </React.Suspense>
        )}
      {s && <SlipPanel w={w} />}
    </>
  );
}
