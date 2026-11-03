// Bootstrap domain extracted from useCoreWorkflow: capabilities handshake,
// initial project listing, and capability guards.
import { useCallback, useEffect, useState } from "react";
import type {
  CapabilityAvailability,
  OperationName,
  ProjectSummary,
} from "@anticipate/contracts";
import { CoreClientError, ForgeClient } from "../api/ForgeClient";
import { useResource } from "../useResource";
import { UPGRADE_CAPABILITY } from "./workflow";

export function useBootstrap(client: ForgeClient) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectCursor, setProjectCursor] = useState<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      // Both start together: each Forge invocation costs ~0.5-3.7 s on a cold
      // start (LIVE_FORGE timings). The listing is read-only and is used only
      // if capabilities then confirm Jira read; otherwise it is discarded.
      const listing = client
        .request("listProjects", { cursor: null }, signal)
        .then(
          (data) => ({ ok: true as const, data }),
          (error: unknown) => ({ ok: false as const, error }),
        );
      const capabilities = await client.request("getCapabilities", {}, signal);
      const available =
        capabilities.jiraRead === "AVAILABLE" &&
        capabilities.operations.includes("listProjects");
      if (!available) return { capabilities, first: null };
      const result = await listing;
      if (!result.ok) throw result.error;
      return { capabilities, first: result.data };
    },
    [client],
  );
  const resource = useResource(load);
  const bootstrap = resource.status === "ready" ? resource.data : null;
  useEffect(() => {
    if (bootstrap) {
      setProjects(bootstrap.first?.items ?? []);
      setProjectCursor(bootstrap.first?.page.nextCursor ?? null);
    }
  }, [bootstrap]);
  const capabilities: CapabilityAvailability | null =
    resource.status === "ready" ? resource.data.capabilities : null;
  const allowed = (op: OperationName) =>
    capabilities?.operations.includes(op) ?? false;
  // Upgrade comparisons are offered only when the backend says it supports them.
  const upgradeSupported =
    capabilities?.operations.includes(UPGRADE_CAPABILITY) ?? false;
  function requireOperation(op: OperationName) {
    if (!allowed(op))
      throw new CoreClientError(
        "UNSUPPORTED",
        `${op} is not enabled by the backend.`,
      );
  }
  return {
    resource,
    capabilities,
    allowed,
    requireOperation,
    upgradeSupported,
    projects,
    setProjects,
    projectCursor,
    setProjectCursor,
  };
}
