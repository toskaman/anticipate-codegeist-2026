// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import { CoreClientError } from "./api/ForgeClient";

let consoleSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  consoleSpy.mockRestore();
});

function Thrower({ error }: { error: unknown }): React.ReactNode {
  throw error;
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>healthy view</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy view")).toBeTruthy();
  });

  it("shows the code and requestId of a CoreClientError", () => {
    render(
      <ErrorBoundary>
        <Thrower
          error={
            new CoreClientError(
              "TIMEOUT",
              "Response not received.",
              "req-123",
              true,
            )
          }
        />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/TIMEOUT/)).toBeTruthy();
    expect(screen.getByText(/req-123/)).toBeTruthy();
  });

  it("offers a targeted retry that resets the boundary and notifies the caller", () => {
    let fail = true;
    const onRetry = vi.fn();
    const Flaky = () => {
      if (fail) throw new CoreClientError("TIMEOUT", "Slow backend.", null);
      return <p>recovered view</p>;
    };
    render(
      <ErrorBoundary onRetry={onRetry}>
        <Flaky />
      </ErrorBoundary>,
    );
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("recovered view")).toBeTruthy();
  });

  it("announces the failure through an assertive live region", () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error("boom")} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe(
      "assertive",
    );
  });

  it("still renders a generic fallback for non-core errors", () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error("boom")} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("This view could not be loaded")).toBeTruthy();
    expect(screen.queryByText(/Request ID/)).toBeNull();
  });
});
