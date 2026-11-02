// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResource } from "./useResource";
afterEach(cleanup);
describe("async resource lifecycle", () => {
  it("shows loading then data", async () => {
    let resolve!: (value: string[]) => void;
    const loader = () => new Promise<string[]>((done) => (resolve = done));
    const { result } = renderHook(() => useResource(loader));
    expect(result.current.status).toBe("loading");
    await act(async () => resolve([]));
    expect(result.current).toMatchObject({ status: "ready", data: [] });
  });
  it("exposes errors and retries the real loader", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("Snapshot unavailable"))
      .mockResolvedValueOnce(["recovered"]);
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: "ready",
        data: ["recovered"],
      }),
    );
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("ignores obsolete responses after the loader changes", async () => {
    let resolveOld!: (v: string) => void;
    const oldLoader = () =>
      new Promise<string>((resolve) => (resolveOld = resolve));
    const newLoader = async () => "current";
    const { result, rerender } = renderHook(
      ({ loader }) => useResource(loader),
      { initialProps: { loader: oldLoader } },
    );
    rerender({ loader: newLoader });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: "ready",
        data: "current",
      }),
    );
    await act(async () => resolveOld("obsolete"));
    expect(result.current).toMatchObject({ status: "ready", data: "current" });
  });
});
