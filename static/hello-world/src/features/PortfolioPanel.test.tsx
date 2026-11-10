// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

function renderLive() {
  const client = new ForgeClient(async () => {
    throw new Error("no backend calls expected");
  }, 5000);
  render(
    <PortfolioPanel
      w={{
        client,
        capabilities: CapabilityAvailability.parse({
          ...capabilities,
          portfolioSimulation: "AVAILABLE",
          operations: [...capabilities.operations, "simulatePortfolio"],
        }),
        snapshot: graph,
        rootIssueKey: "ABC-1",
        busy: "",
      }}
    />,
  );
}
function draftMigration() {
  fireEvent.click(screen.getByRole("button", { name: "Add change" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Move to replacement" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
    target: { value: "migrate" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Record" }), {
    target: { value: graph.nodes[0].id },
  });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Replacement record" }),
    { target: { value: graph.nodes[2].id } },
  );
}
it("completes a lone migration with its breaking counterpart in one click", async () => {
  renderLive();
  expect(
    screen.queryByRole("button", { name: "Complete the collision pair" }),
  ).toBeNull();
  draftMigration();
  const complete = screen.getByRole("button", {
    name: "Complete the collision pair",
  });
  expect(complete.getAttribute("title")).toContain(graph.nodes[2].label);
  fireEvent.click(complete);
  expect(screen.getAllByRole("group", { name: /^Change \d+$/ })).toHaveLength(
    2,
  );
  expect(
    screen.getByDisplayValue(`Breaking upgrade of ${graph.nodes[2].label}`),
  ).toBeTruthy();
  const simulate = screen.getByRole("button", {
    name: "Simulate combined changes",
  }) as HTMLButtonElement;
  expect(simulate.disabled).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(simulate));
  expect(
    screen.queryByRole("button", { name: "Complete the collision pair" }),
  ).toBeNull();
});
it("offers no counterpart for an incomplete migration", () => {
  renderLive();
  fireEvent.click(screen.getByRole("button", { name: "Add change" }));
  expect(
    screen.queryByRole("button", { name: "Complete the collision pair" }),
  ).toBeNull();
});
