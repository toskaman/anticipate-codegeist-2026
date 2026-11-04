// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { comparison, graph } from "../../tests/core-test-data";
import ScenarioDifference from "./ScenarioDifference";

afterEach(cleanup);

describe("honest comparison inspection", () => {
  it("does not borrow labels from a different snapshot", () => {
    render(
      <ScenarioDifference
        results={comparison.results}
        graph={{ ...graph, snapshotId: "unrelated" }}
      />,
    );
    expect(screen.getByText(/Snapshot not loaded/)).toBeTruthy();
    expect(screen.queryByText("ABC-2 Consumer")).toBeNull();
    expect(screen.getByText("issue:ABC-2")).toBeTruthy();
  });
  it("bounds record rendering and discloses omitted records", () => {
    const impact = comparison.results[0].impacts[0];
    const left = {
      ...comparison.results[0],
      impacts: Array.from({ length: 50 }, (_, index) => ({
        ...impact,
        nodeId: `unloaded:${index}`,
      })),
    };
    const right = { ...comparison.results[1], impacts: [] };
    render(<ScenarioDifference results={[left, right]} graph={null} />);
    const group = screen.getByRole("region", {
      name: "Only listed in Remove now",
    });
    expect(within(group).getAllByRole("listitem")).toHaveLength(6);
    expect(within(group).getByText(/Showing 6 of 50/)).toBeTruthy();
    expect(screen.getByText(/not proof that it is safe/)).toBeTruthy();
  });
  it("refuses to present an incompatible snapshot pair as a result", () => {
    render(
      <ScenarioDifference
        results={[
          comparison.results[0],
          { ...comparison.results[1], snapshotId: "other" },
        ]}
        graph={graph}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "do not share a snapshot",
    );
    expect(
      screen.queryByRole("region", { name: "Listed in both options" }),
    ).toBeNull();
  });
});
