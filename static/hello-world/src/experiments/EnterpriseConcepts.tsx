import React from "react";
import { Badge, Notice, Panel } from "../components/ui";
import { evidenceCopy, type EvidenceStatus } from "../app/copy";

/** Frontend-only design proposals. Never imported by the production entry tree. */
export interface PortfolioConceptModel {
  snapshotLabel: string;
  changes: string[];
  sharedRecords: {
    id: string;
    label: string;
    changeLabels: string[];
    status: EvidenceStatus;
  }[];
  conflicts: string[];
  unknowns: string[];
}
export interface SharedDecisionConceptModel {
  versionLabel: string;
  waitingFor: string;
  roles: { role: string; actor: string | null; explanation: string }[];
  events: { id: string; at: string; explanation: string }[];
}
export interface RadarConceptModel {
  state: "NOT_CONFIGURED" | "DEGRADED" | "OBSERVED";
  lastObservation: string | null;
  items: {
    id: string;
    decisionLabel: string;
    reason: string;
    nextStep: string;
  }[];
}

function Concept({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={`${title} concept`}>
      <Notice tone="warning" title="Design concept — not connected">
        Proposed interface only. No live monitoring, role authorization or Jira
        action is performed by this view.
      </Notice>
      <Panel title={title}>{children}</Panel>
    </section>
  );
}

const pending = (
  <p>
    Backend contract and capability are pending. The working single-change
    journey remains the production experience.
  </p>
);
const remaining = (count: number) =>
  count > 6 ? (
    <p className="ax-muted">
      Showing 6 of {count} example entries; remaining entries omitted from this
      concept.
    </p>
  ) : null;

export function PortfolioImpactConcept({
  model,
}: {
  model?: PortfolioConceptModel;
}) {
  return (
    <Concept title="Portfolio impact">
      {model ? (
        <>
          <p>
            Example evidence set: {model.snapshotLabel}. Simulation only; an
            ordering is not permission to execute.
          </p>
          <h3>Proposed changes</h3>
          <ul>
            {model.changes.slice(0, 6).map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
          {remaining(model.changes.length)}
          <h3>Shared affected records</h3>
          <ul>
            {model.sharedRecords.slice(0, 6).map((record) => (
              <li key={record.id}>
                {record.label} · {record.changeLabels.slice(0, 6).join(", ")}{" "}
                <Badge tone={evidenceCopy[record.status].tone}>
                  {evidenceCopy[record.status].label}
                </Badge>
              </li>
            ))}
          </ul>
          {remaining(model.sharedRecords.length)}
          <h3>Conflicts and open evidence</h3>
          <ul>
            {[...model.conflicts, ...model.unknowns]
              .slice(0, 6)
              .map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
          </ul>
          {!model.conflicts.length && (
            <p>
              No conflict is listed in this example. Unassessed interactions are
              not proven conflict-free.
            </p>
          )}
        </>
      ) : (
        pending
      )}
    </Concept>
  );
}

export function SharedDecisionConcept({
  model,
}: {
  model?: SharedDecisionConceptModel;
}) {
  return (
    <Concept title="Shared decision">
      {model ? (
        <>
          <p>
            {model.versionLabel} · Waiting for: {model.waitingFor}
          </p>
          <p>
            Roles and permitted actions must be checked on the server. This
            concept offers no approve, reject, revoke or execute control.
          </p>
          <h3>Role explanations</h3>
          <ul>
            {model.roles.slice(0, 6).map((role) => (
              <li key={role.role}>
                <strong>{role.role}</strong> ·{" "}
                {role.actor ?? "Actor not supplied"} · {role.explanation}
              </li>
            ))}
          </ul>
          {remaining(model.roles.length)}
          <h3>Example decision history</h3>
          <ol>
            {model.events.slice(0, 6).map((event) => (
              <li key={event.id}>
                {event.at} · {event.explanation}
              </li>
            ))}
          </ol>
          {remaining(model.events.length)}
        </>
      ) : (
        pending
      )}
    </Concept>
  );
}

export function DecisionRadarConcept({ model }: { model?: RadarConceptModel }) {
  return (
    <Concept title="Decision radar">
      {model ? (
        <>
          <p>
            No live subscription is connected. Example feed state: {model.state}
            .
          </p>
          <p>
            Example last observation:{" "}
            {model.lastObservation ?? "Not supplied — coverage is unknown"}.
          </p>
          {model.state !== "OBSERVED" || !model.lastObservation ? (
            <p>
              Observation coverage is incomplete. An empty queue must not be
              displayed as a healthy zero.
            </p>
          ) : (
            <p>
              This example observation does not establish continuous coverage or
              safety.
            </p>
          )}
          <h3>Example attention items</h3>
          <ul>
            {model.items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <strong>{item.decisionLabel}</strong> · {item.reason} · Next
                review step: {item.nextStep}
              </li>
            ))}
          </ul>
          {remaining(model.items.length)}
        </>
      ) : (
        pending
      )}
    </Concept>
  );
}
