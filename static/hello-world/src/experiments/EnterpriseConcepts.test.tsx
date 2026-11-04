// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DecisionRadarConcept,
  PortfolioImpactConcept,
  SharedDecisionConcept,
} from "./EnterpriseConcepts";

afterEach(cleanup);
describe("passive enterprise design concepts", () => {
  it("keeps every missing-contract view visibly unconnected with no action control", () => {
    render(
      <>
        <PortfolioImpactConcept />
        <SharedDecisionConcept />
        <DecisionRadarConcept />
      </>,
    );
    expect(screen.getAllByText("Design concept — not connected")).toHaveLength(
      3,
    );
    expect(
      screen.getAllByText(/Backend contract and capability are pending/),
    ).toHaveLength(3);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
  it("bounds a proposed portfolio and retains unknown evidence", () => {
    render(
      <PortfolioImpactConcept
        model={{
          snapshotLabel: "Authored concept only",
          changes: ["Retire v1", "Move checkout"],
          sharedRecords: Array.from({ length: 20 }, (_, index) => ({
            id: `sample-${index}`,
            label: `Example ${index}`,
            changeLabels: ["Retire v1"],
            status: "UNKNOWN",
          })),
          conflicts: [],
          unknowns: ["Consumer ownership not supplied"],
        }}
      />,
    );
    expect(screen.getAllByText("Unknown")).toHaveLength(6);
    expect(screen.getByText(/Showing 6 of 20/)).toBeTruthy();
    expect(screen.getByText(/not proven conflict-free/)).toBeTruthy();
    expect(screen.getByText("Design concept — not connected")).toBeTruthy();
  });
  it("does not turn an empty degraded feed or missing actor into a healthy/authorized claim", () => {
    render(
      <>
        <DecisionRadarConcept
          model={{ state: "DEGRADED", lastObservation: null, items: [] }}
        />
        <SharedDecisionConcept
          model={{
            versionLabel: "Example v1",
            waitingFor: "Approver role",
            roles: [
              {
                role: "Approver",
                actor: null,
                explanation: "Server permission not yet supplied",
              },
            ],
            events: [],
          }}
        />
      </>,
    );
    expect(
      screen.getByText(/empty queue must not be displayed as a healthy zero/),
    ).toBeTruthy();
    expect(screen.getByText(/Actor not supplied/)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByText("Design concept — not connected")).toHaveLength(
      2,
    );
  });
});
