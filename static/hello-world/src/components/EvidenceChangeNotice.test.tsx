// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvidenceChangeNotice from "./EvidenceChangeNotice";
import type { Workflow } from "../app/useCoreWorkflow";

afterEach(cleanup);

const reason =
  "Plan invalidated: evidence changed after approval: 1 relation added";
const workflow = (status: string, timeline: { at: string; event: string }[]) =>
  ({
    plan: { status },
    evidenceFailure: null,
    busy: "",
    passport: { timeline },
    actions: { rebuildSnapshot: vi.fn() },
  }) as unknown as Workflow;

describe("EvidenceChangeNotice for INVALIDATED plans (ORP-22)", () => {
  it("renders the alert with the latest invalidation reason from the timeline", () => {
    render(
      <EvidenceChangeNotice
        w={workflow("INVALIDATED", [
          { at: "2026-11-03T10:00:00Z", event: "Plan approved" },
          { at: "2026-11-03T11:00:00Z", event: reason },
        ])}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("Evidence changed — this plan cannot execute"),
    ).toBeTruthy();
    expect(screen.getByText(reason)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Rebuild snapshot" }),
    ).toBeTruthy();
  });
  it("falls back to a generic reason when the timeline has none", () => {
    render(<EvidenceChangeNotice w={workflow("INVALIDATED", [])} />);
    expect(
      screen.getByText("The evidence changed since this plan was built."),
    ).toBeTruthy();
  });
  it("renders nothing for an APPROVED plan", () => {
    const { container } = render(
      <EvidenceChangeNotice w={workflow("APPROVED", [])} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
