// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SafeChangeComposer from "./SafeChangeComposer";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
import fixture from "../../tests/composer-demo2.json";
afterEach(cleanup);

// P0-C2 UI half: clicking "Select for review" invokes the parent onSelect callback
// with the chosen candidate. Selection is a proposal handoff, never an approval.
const request = {
  projectId: "TD",
  rootIssueKey: "TD-1",
  source: "JIRA" as const,
  snapshotId: "snap-td-demo2",
  changes: [
    {
      id: "A-migrate-to-v2",
      label: "Move consumers of TD-1 to TD-5",
      operations: [
        {
          op: "MIGRATE_DEPENDENTS" as const,
          fromNodeId: "issue:TD-1",
          toNodeId: "issue:TD-5",
          edgeKinds: ["DEPENDS_ON" as const],
        },
      ],
    },
    {
      id: "B-break-v2",
      label: "Breaking upgrade of TD-5",
      operations: [
        { op: "UPGRADE_NODE" as const, nodeId: "issue:TD-5", breaking: true },
      ],
    },
  ],
};

it("invokes onSelect with the chosen candidate and marks it picked", async () => {
  const onSelect = vi.fn();
  const ops: string[] = [];
  const client = new ForgeClient(async (op) => {
    ops.push(op);
    return response(fixture);
  }, 5000);
  render(
    <SafeChangeComposer
      client={client}
      request={request}
      onSelect={onSelect}
    />,
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Compose safer alternatives" }),
    );
  });
  expect(ops).toEqual(["composeSafeChanges"]);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Select for review" })[0]!,
  );
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect.mock.calls[0]![0]).toMatchObject({
    candidateId: "cand-1",
    kind: "COMPATIBLE_UPGRADE",
  });
  expect(
    screen.getByRole("button", { name: "Selected for review" }),
  ).toBeTruthy();
  expect(screen.getByRole("status").textContent).toMatch(/not approved/);
});
