// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  CapabilityAvailability,
  OPERATIONS,
  type SimulatePortfolioRequest,
} from "@anticipate/contracts";
import { ForgeClient } from "../api/ForgeClient";
import PortfolioPanel from "./PortfolioPanel";
import { capabilities, graph, response } from "../../tests/core-test-data";
import { mockPortfolioResult } from "../../tests/portfolio-test-data";

afterEach(cleanup);
it("keeps pending work read-only and drops its response when the analysed snapshot changes", async () => {
  let finish!: (value: unknown) => void;
  let request!: SimulatePortfolioRequest;
  const operations: string[] = [];
  const client = new ForgeClient(async (operation, input) => {
    operations.push(operation);
    request = OPERATIONS.simulatePortfolio.input.parse(input);
    return new Promise((resolve) => {
      finish = resolve;
    });
  }, 5000);
  const w = {
    client,
    capabilities: CapabilityAvailability.parse({
      ...capabilities,
      portfolioSimulation: "AVAILABLE",
      operations: [...capabilities.operations, "simulatePortfolio"],
    }),
    snapshot: graph,
    rootIssueKey: "ABC-1",
    busy: "",
  };
  const view = render(<PortfolioPanel w={w} />);
  fireEvent.click(screen.getByRole("button", { name: "Add change" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Record" }), {
    target: { value: graph.nodes[0].id },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Simulate combined changes" }),
  );
  expect(screen.getByRole("status").textContent).toContain(
    "Simulating combined changes",
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Simulating portfolio…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("combobox", { name: "Record" }) as HTMLSelectElement)
      .disabled ||
      screen
        .getByRole("combobox", { name: "Record" })
        .closest("fieldset[disabled]") !== null,
  ).toBe(true);
  view.rerender(
    <PortfolioPanel
      w={{ ...w, snapshot: { ...graph, snapshotId: "next-snapshot" } }}
    />,
  );
  await act(async () => {
    finish(response(mockPortfolioResult(request)));
  });
  expect(
    screen.queryByRole("heading", { name: "Combined simulation" }),
  ).toBeNull();
  expect(screen.getByText(/No changes added/)).toBeTruthy();
  expect(operations).toEqual(["simulatePortfolio"]);
});
