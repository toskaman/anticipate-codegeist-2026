// @vitest-environment jsdom
// TITAN-5 P0: the explicitly chosen issue must always be the one sent to the
// backend, even when selection and analysis happen in the same tick (the
// Release Safety / Release Command Center "Analyze" wiring calls
// chooseCandidate(key) then analyze() synchronously). MOCK_TRANSPORT only.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { GraphSnapshot, ProjectSummary } from "@anticipate/contracts";
import { CoreClientError, ForgeClient } from "../api/ForgeClient";
import { useCoreWorkflow } from "./useCoreWorkflow";
import { capabilities, graph, response } from "../../tests/core-test-data";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const relProject: ProjectSummary = {
  id: "100",
  key: "REL",
  name: "Release train",
  url: null,
  issueCount: 2,
  lastSnapshotAt: null,
  dataAvailability: "READY",
};

const issueNode = (key: string) => ({
  ...graph.nodes[0]!,
  id: `issue:${key}`,
  label: `${key} change`,
  references: [
    {
      ...graph.nodes[0]!.references[0]!,
      sourceId: key,
      url: `https://example.invalid/browse/${key}`,
    },
  ],
});

const graphFor = (
  snapshotId: string,
  roots: string[] = ["REL-1", "REL-2", "REL-3"],
): GraphSnapshot => ({
  ...graph,
  snapshotId,
  projectId: "100",
  nodes: [...roots.map(issueNode), ...graph.nodes],
});

function setup(opts?: {
  evidenceRoots?: string[];
  failSnapshot?: (key: string) => unknown;
}) {
  const snapCalls: string[] = [];
  const resolvers: Array<() => void> = [];
  const client = new ForgeClient(async (operation, input) => {
    if (operation === "getCapabilities") return response(capabilities);
    if (operation === "listProjects")
      return response({
        items: [relProject],
        page: { nextCursor: null, totalKnown: 1 },
      });
    if (operation === "getGraphSnapshot") {
      snapCalls.push(input.rootIssueKey as string);
      if (opts?.failSnapshot)
        throw opts.failSnapshot(input.rootIssueKey as string);
      return new Promise((resolve) => {
        resolvers.push(() =>
          resolve(
            response({ ...graphFor(`snap-${input.rootIssueKey as string}`) }),
          ),
        );
      });
    }
    if (operation === "getEvidenceGraph")
      return response(
        graphFor(input.snapshotId as string, opts?.evidenceRoots),
      );
    throw new Error(`unexpected ${operation}`);
  });
  return { client, snapCalls, resolvers };
}

async function ready(opts?: Parameters<typeof setup>[0]) {
  const s = setup(opts);
  const hook = renderHook(() => useCoreWorkflow(s.client));
  await waitFor(() => expect(hook.result.current.capabilities).not.toBeNull());
  await waitFor(() => expect(hook.result.current.projects).toHaveLength(1));
  act(() => {
    hook.result.current.actions.selectProject("100");
  });
  return { hook, ...s };
}

it("sends the newly chosen issue when selection and analysis happen in the same tick", async () => {
  const { hook, snapCalls, resolvers } = await ready();
  // Prior state: REL-1 was selected and fully analysed.
  act(() => {
    hook.result.current.actions.chooseCandidate("REL-1");
  });
  let flight: Promise<void>;
  act(() => {
    flight = hook.result.current.actions.analyze() as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toEqual(["REL-1"]));
  await act(async () => {
    resolvers[0]!();
    await flight;
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-1");
  // The user now clicks "Analyze REL-2": same-tick choose + analyze.
  act(() => {
    hook.result.current.actions.chooseCandidate("REL-2");
    flight = hook.result.current.actions.analyze() as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toHaveLength(2));
  expect(snapCalls[1]).toBe("REL-2");
  await act(async () => {
    resolvers[1]!();
    await flight;
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-2");
});

it("analyzeIssue sends the explicit key even when state holds another", async () => {
  const { hook, snapCalls, resolvers } = await ready();
  act(() => {
    hook.result.current.actions.chooseCandidate("REL-1");
  });
  let flight: Promise<void>;
  act(() => {
    flight = hook.result.current.actions.analyzeIssue(
      "REL-2",
    ) as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toEqual(["REL-2"]));
  await act(async () => {
    resolvers[0]!();
    await flight;
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-2");
  expect(hook.result.current.rootIssueKey).toBe("REL-2");
});

it("analyzeIssue rejects a malformed key without any network call", async () => {
  const { hook, snapCalls } = await ready();
  await act(async () => {
    await hook.result.current.actions.analyzeIssue("nope");
  });
  expect(snapCalls).toHaveLength(0);
  expect(hook.result.current.error?.code).toBe("VALIDATION");
  expect(hook.result.current.snapshot).toBeNull();
});

it("analyzeIssue rejects a key outside the selected project", async () => {
  const { hook, snapCalls } = await ready();
  await act(async () => {
    await hook.result.current.actions.analyzeIssue("OTHER-1");
  });
  expect(snapCalls).toHaveLength(0);
  expect(hook.result.current.error?.code).toBe("VALIDATION");
  expect(hook.result.current.snapshot).toBeNull();
});

it("a double analyzeIssue for the same key starts a single flight", async () => {
  const { hook, snapCalls, resolvers } = await ready();
  let first: unknown;
  let second: unknown;
  act(() => {
    first = hook.result.current.actions.analyzeIssue("REL-2");
    second = hook.result.current.actions.analyzeIssue("REL-2");
  });
  await waitFor(() => expect(snapCalls.length).toBeGreaterThan(0));
  await act(async () => {
    await Promise.resolve();
  });
  expect(snapCalls).toEqual(["REL-2"]);
  expect(second).toBeUndefined();
  await act(async () => {
    resolvers[0]!();
    await first;
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-2");
});

it("analyzing REL-3 while REL-2 is in flight cancels REL-2; the late REL-2 response is ignored", async () => {
  const { hook, snapCalls, resolvers } = await ready();
  let flight2: Promise<void>;
  let flight3: Promise<void>;
  act(() => {
    flight2 = hook.result.current.actions.analyzeIssue(
      "REL-2",
    ) as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toEqual(["REL-2"]));
  act(() => {
    flight3 = hook.result.current.actions.analyzeIssue(
      "REL-3",
    ) as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toEqual(["REL-2", "REL-3"]));
  await act(async () => {
    resolvers[1]!();
    await flight3;
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-3");
  await act(async () => {
    resolvers[0]!();
    await flight2;
    await new Promise((r) => setTimeout(r, 10));
  });
  expect(hook.result.current.snapshot?.snapshotId).toBe("snap-REL-3");
});

it("a server permission refusal surfaces an error and sets no snapshot", async () => {
  const { hook, snapCalls } = await ready({
    failSnapshot: (key: string) =>
      new CoreClientError("PERMISSION_DENIED", `You cannot browse ${key}.`),
  });
  await act(async () => {
    await hook.result.current.actions.analyzeIssue("REL-1");
  });
  expect(snapCalls).toEqual(["REL-1"]);
  expect(hook.result.current.error?.code).toBe("PERMISSION_DENIED");
  expect(hook.result.current.snapshot).toBeNull();
});

it("a graph without the requested root is rejected, never displayed", async () => {
  const { hook, snapCalls, resolvers } = await ready({
    evidenceRoots: ["REL-9"],
  });
  let flight: Promise<void>;
  act(() => {
    flight = hook.result.current.actions.analyzeIssue(
      "REL-1",
    ) as unknown as Promise<void>;
  });
  await waitFor(() => expect(snapCalls).toEqual(["REL-1"]));
  await act(async () => {
    resolvers[0]!();
    await flight;
  });
  expect(hook.result.current.error?.code).toBe("INVALID_RESPONSE");
  expect(hook.result.current.snapshot).toBeNull();
});
