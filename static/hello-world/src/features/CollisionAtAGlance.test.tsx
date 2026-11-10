// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SimulatePortfolioResult } from "@anticipate/contracts";
import CollisionAtAGlance from "./CollisionAtAGlance";
import { graph } from "../../tests/core-test-data";
import { mockPortfolioResult } from "../../tests/portfolio-test-data";

afterEach(cleanup);
const input = {
  projectId: "10000",
  rootIssueKey: "ABC-1",
  source: "JIRA" as const,
  snapshotMaxDepth: 3,
  changes: [
    { id: "change-1", label: "Move consumers to v2", operations: [] },
    { id: "change-2", label: "Breaking upgrade of v2", operations: [] },
  ],
} as unknown as Parameters<typeof mockPortfolioResult>[0];

function withEmergent(): SimulatePortfolioResult {
  const r = mockPortfolioResult(input);
  return {
    ...r,
    emergentImpacts: [
      { nodeId: graph.nodes[2].id, changeIds: ["change-1", "change-2"] },
    ],
    verdictExplanations: [
      {
        changeId: "change-1",
        standaloneVerdict: "PASS",
        portfolioVerdict: "BLOCKED",
        changedByOthers: true,
        gainedNodeIds: [],
        maskedNodeIds: [],
        marginalNodeIds: [],
        causes: [],
        jointlyCausedNodeIds: [],
        explanation: "",
      },
    ],
  };
}

it("shows each change alone next to the combined verdict, from backend values only", () => {
  render(<CollisionAtAGlance result={withEmergent()} graph={graph} />);
  const region = screen.getByRole("region", { name: "Collision at a glance" });
  const cards = within(region).getAllByRole("listitem");
  expect(cards[0].textContent).toContain("Change A · alone");
  expect(cards[0].textContent).toContain("Move consumers to v2");
  expect(cards[0].textContent).toContain("Pass");
  expect(cards[1].textContent).toContain("Change B · alone");
  expect(cards[1].textContent).toContain("Blocked");
  expect(cards[2].textContent).toContain("together");
  expect(cards[2].textContent).toContain("1 only when combined");
  expect(region.textContent).toContain(
    "Affected only when the changes run together",
  );
  expect(region.textContent).toContain(graph.nodes[2].label);
  expect(region.textContent).toContain(
    "Move consumers to v2: alone Pass, together Blocked.",
  );
  expect(region.textContent).toContain("Nothing has been changed in Jira.");
});

it("does not claim a collision or safety when none is reported", () => {
  const r = mockPortfolioResult(input);
  render(
    <CollisionAtAGlance
      result={{
        ...r,
        conflicts: [],
        emergentImpacts: [],
        verdictExplanations: [],
      }}
      graph={graph}
    />,
  );
  const region = screen.getByRole("region", {
    name: "Combined result at a glance",
  });
  expect(region.textContent).toContain("not proof the changes are safe");
  expect(region.textContent).not.toContain("only when combined");
});

it("headlines the worst alone-to-together verdict shift before the cards", () => {
  render(<CollisionAtAGlance result={withEmergent()} graph={graph} />);
  const region = screen.getByRole("region", { name: "Collision at a glance" });
  const hero = within(region).getByTestId("collision-hero");
  expect(hero.textContent).toContain(
    "Move consumers to v2 goes from Pass alone to Blocked together.",
  );
  const row = region.querySelector(".ax-glance__row");
  expect(
    !!row &&
      !!(hero.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING),
  ).toBe(true);
});

it("headlines the worst shift and counts the others", () => {
  const r = withEmergent();
  render(
    <CollisionAtAGlance
      result={{
        ...r,
        verdictExplanations: [
          ...r.verdictExplanations,
          {
            ...r.verdictExplanations[0],
            changeId: "change-2",
            standaloneVerdict: "PASS",
            portfolioVerdict: "NEEDS_REVIEW",
          },
        ],
      }}
      graph={graph}
    />,
  );
  const hero = within(
    screen.getByRole("region", { name: "Collision at a glance" }),
  ).getByTestId("collision-hero");
  expect(hero.textContent).toContain(
    "Move consumers to v2 goes from Pass alone to Blocked together.",
  );
  expect(hero.textContent).toContain("1 more change also worsens.");
});

it("shows no hero line when no verdict worsens", () => {
  const r = mockPortfolioResult(input);
  render(
    <CollisionAtAGlance
      result={{
        ...r,
        conflicts: [],
        emergentImpacts: [],
        verdictExplanations: [],
      }}
      graph={graph}
    />,
  );
  expect(
    within(
      screen.getByRole("region", { name: "Combined result at a glance" }),
    ).queryByTestId("collision-hero"),
  ).toBeNull();
});
