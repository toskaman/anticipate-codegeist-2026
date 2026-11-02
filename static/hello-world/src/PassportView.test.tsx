// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import PassportView from "./PassportView";
import { FixtureClient } from "./api/FixtureClient";
import { type AnticipateClient } from "./api/provisional-contracts";
afterEach(cleanup);
describe("passport data boundary", () => {
  it("renders an honest fixture with no invented approval", async () => {
    render(
      <PassportView
        client={new FixtureClient()}
        snapshotId="demo-auth-v1-2026-11-02"
        scenarioId="C"
      />,
    );
    await screen.findByText("AUTH-142");
    expect(
      screen.getByText(
        "No authenticated approval or verified execution recorded.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Execution: Requires live authenticated backend/),
    ).toBeTruthy();
    expect(screen.getByText("Support usage unknown")).toBeTruthy();
  });
  it("refuses a response for another snapshot before exposing export", async () => {
    const fixture = new FixtureClient();
    const client: AnticipateClient = {
      getCapabilities: () => fixture.getCapabilities(),
      getProjects: () => fixture.getProjects(),
      request: async (operation, input) => {
        const response = await fixture.request(operation, input);
        return {
          ...(response as Record<string, unknown>),
          snapshot: "wrong-snapshot",
        };
      },
    };
    render(
      <PassportView
        client={client}
        snapshotId="demo-auth-v1-2026-11-02"
        scenarioId="C"
      />,
    );
    await screen.findByText(
      "Report does not match the selected snapshot and scenario",
    );
    expect(
      screen.queryByRole("button", { name: "Export demo JSON" }),
    ).toBeNull();
  });
  it("rejects unknown fixture snapshots instead of fabricating a report", async () => {
    await expect(
      new FixtureClient().request("getPreventionPassport", {
        snapshotId: "expired",
        scenarioId: "C",
      }),
    ).rejects.toMatchObject({ code: "SNAPSHOT_EXPIRED" });
  });
});
