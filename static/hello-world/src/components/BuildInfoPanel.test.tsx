// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import { ForgeClient } from "../api/ForgeClient";
import { response } from "../../tests/core-test-data";
import BuildInfoPanel from "./BuildInfoPanel";

const SHA = "bbdb83505ec284e617f661eaf0dfececace72635";
const AT = "2026-11-09T01:47:42.000Z";

const clientFor = (data: unknown, onCall?: () => void) =>
  new ForgeClient(async () => {
    onCall?.();
    return response(data);
  });

function deferredClient() {
  const calls: string[] = [];
  let release!: (v: unknown) => void;
  const gate = new Promise<unknown>((res) => {
    release = res;
  });
  const client = new ForgeClient(async (operation) => {
    calls.push(operation);
    return gate;
  });
  return { client, calls, release };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BuildInfoPanel (#217)", () => {
  it("shows short SHA, full SHA, localized date and exact UTC for a stamped build", async () => {
    render(<BuildInfoPanel client={clientFor({ commit: SHA, builtAt: AT })} />);
    expect(
      await screen.findByRole("heading", { name: "Build Information" }),
    ).toBeTruthy();
    expect(screen.getByText("bbdb835")).toBeTruthy();
    expect(screen.getByText(SHA)).toBeTruthy();
    const time = document.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(AT);
    expect(time?.getAttribute("title")).toBe(AT);
  });

  it("explains an unstamped build without placeholder metadata", async () => {
    render(
      <BuildInfoPanel client={clientFor({ commit: null, builtAt: null })} />,
    );
    expect(await screen.findByText(/build metadata unavailable/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });

  it("shows the available value and names the missing one for partial metadata", async () => {
    const { unmount } = render(
      <BuildInfoPanel client={clientFor({ commit: SHA, builtAt: null })} />,
    );
    expect(await screen.findByText("bbdb835")).toBeTruthy();
    expect(screen.getByText("Not reported by this deployment.")).toBeTruthy();
    unmount();
    render(
      <BuildInfoPanel client={clientFor({ commit: null, builtAt: AT })} />,
    );
    expect(
      await screen.findByText("Not reported by this deployment."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });

  it("distinguishes resolver failure from null metadata and retries on demand", async () => {
    let calls = 0;
    const client = new ForgeClient(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return response({ commit: SHA, builtAt: AT });
    });
    render(<BuildInfoPanel client={client} />);
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(screen.queryByText(/build metadata unavailable/i)).toBeNull();
    fireEvent.click(retry);
    expect(await screen.findByText("bbdb835")).toBeTruthy();
    expect(calls).toBe(2);
  });

  it("shows a loading state with no placeholder values", () => {
    render(
      <BuildInfoPanel
        client={
          new ForgeClient(async () => {
            await new Promise(() => {});
            return response({ commit: SHA, builtAt: AT });
          })
        }
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(
      /loading build information/i,
    );
    expect(screen.queryByText("bbdb835")).toBeNull();
  });

  it("copies the full SHA and confirms with feedback", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<BuildInfoPanel client={clientFor({ commit: SHA, builtAt: AT })} />);
    const copy = await screen.findByRole("button", { name: /copy full/i });
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHA));
    expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy();
  });

  it("makes no duplicate concurrent requests while one is in flight", async () => {
    const { client, calls, release } = deferredClient();
    const { rerender } = render(<BuildInfoPanel client={client} />);
    rerender(<BuildInfoPanel client={client} />);
    rerender(<BuildInfoPanel client={client} />);
    expect(calls).toEqual(["getBuildInfo"]);
    await act(async () => {
      release(response({ commit: SHA, builtAt: AT }));
    });
    expect(await screen.findByText("bbdb835")).toBeTruthy();
    expect(calls).toEqual(["getBuildInfo"]);
  });

  it("makes no repeated requests after a settled response", async () => {
    let calls = 0;
    const client = clientFor({ commit: SHA, builtAt: AT }, () => {
      calls += 1;
    });
    const { rerender } = render(<BuildInfoPanel client={client} />);
    expect(await screen.findByText("bbdb835")).toBeTruthy();
    rerender(<BuildInfoPanel client={client} />);
    rerender(<BuildInfoPanel client={client} />);
    await waitFor(() => expect(calls).toBe(1));
  });

  it("unmounts safely while a request is pending", async () => {
    const errors: unknown[] = [];
    const onError = (e: unknown) => {
      errors.push(e);
    };
    window.addEventListener("error", onError);
    const { client, release } = deferredClient();
    const { unmount } = render(<BuildInfoPanel client={client} />);
    unmount();
    await act(async () => {
      release(response({ commit: SHA, builtAt: AT }));
    });
    window.removeEventListener("error", onError);
    expect(errors).toEqual([]);
  });

  it("renders the 40-character SHA in full and exposes accessible names", async () => {
    render(<BuildInfoPanel client={clientFor({ commit: SHA, builtAt: AT })} />);
    const full = await screen.findByText(SHA);
    expect(full.textContent).toHaveLength(40);
    expect(
      screen.getByRole("button", { name: /copy full sha to clipboard/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("operates the copy action from the keyboard", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<BuildInfoPanel client={clientFor({ commit: SHA, builtAt: AT })} />);
    const copy = (await screen.findByRole("button", {
      name: /copy full/i,
    })) as HTMLButtonElement;
    copy.focus();
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(copy, { key: "Enter", code: "Enter" });
    fireEvent.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHA));
  });
});
