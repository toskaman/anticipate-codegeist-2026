// View-data composition only. All I/O crosses the single AnticipateClient interface.
import { FixtureClient } from "./api/FixtureClient";
import {
  type AnticipateClient,
  snapshotSchema,
  graphSchema,
  comparisonsSchema,
} from "./api/provisional-contracts";
export const fixtureClient = new FixtureClient();
export async function loadExperience(
  client: AnticipateClient = fixtureClient,
  signal?: AbortSignal,
) {
  const capabilities = await client.getCapabilities(signal);
  const projects = await client.getProjects(signal);
  if (projects.length === 0)
    return { kind: "empty" as const, capabilities, projects };
  const snapshot = snapshotSchema.parse(
    await client.request(
      "getProjectSnapshot",
      { projectId: projects[0].id },
      signal,
    ),
  );
  const [graphPayload, comparisonPayload] = await Promise.all([
    client.request("getEvidenceGraph", { snapshotId: snapshot.id }, signal),
    client.request("compareScenarios", { snapshotId: snapshot.id }, signal),
  ]);
  const graph = graphSchema.parse(graphPayload);
  const comparisons = comparisonsSchema.parse(comparisonPayload);
  if (snapshot.mode !== capabilities.mode || graph.mode !== capabilities.mode)
    throw new Error(
      "Data mode mismatch: no fixture/live substitution is permitted",
    );
  if (
    graph.snapshotId !== snapshot.id ||
    comparisons.snapshotId !== snapshot.id
  )
    throw new Error(
      "Snapshot mismatch: evidence and comparisons must use the same snapshot",
    );
  const expectedSource =
    capabilities.mode === "fixture" ? "authored-fixture" : "simulator";
  if (comparisons.source !== expectedSource)
    throw new Error(
      "Comparison provenance does not match the active data mode",
    );
  return {
    kind: "ready" as const,
    projects,
    capabilities,
    services: graph.services,
    scenarios: {
      A: comparisons.results.find((result) => result.id === "A")!.result,
      B: comparisons.results.find((result) => result.id === "B")!.result,
      C: comparisons.results.find((result) => result.id === "C")!.result,
    },
    source: comparisons.source,
    snapshot,
  };
}
