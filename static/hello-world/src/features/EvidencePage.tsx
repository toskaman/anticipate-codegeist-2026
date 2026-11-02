import React, { lazy, Suspense } from "react";
import Icon from "../components/Icon";
import { EmptyState, PageHeader } from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
import EvidenceCoverage from "../components/EvidenceCoverage";

// React Flow loads only when a snapshot is shown, keeping first paint light.
const EvidenceGraph = lazy(() => import("./graph/EvidenceGraph"));

export default function EvidencePage({ w }: { w: Workflow }) {
  const s = w.snapshot;
  return (
    <>
      <PageHeader
        step="Step 2 of 6 · Understand dependencies"
        icon="graph"
        title="Evidence Graph"
        lead={
          s
            ? "What depends on this change, and how strong the evidence is. Every link points to the Jira record it came from."
            : "See what depends on a change before you touch it."
        }
        actions={
          s && (
            <>
              <button
                className="ax-btn ax-btn--ghost"
                onClick={w.actions.exportSnapshot}
              >
                <Icon name="download" size={15} />
                Export snapshot JSON
              </button>
              <button
                className="ax-btn ax-btn--primary"
                disabled={!!w.busy || w.expired}
                onClick={() => w.actions.go("Scenario Lab")}
              >
                Compare options
                <Icon name="arrowRight" size={15} />
              </button>
            </>
          )
        }
      />
      {s && (
        <EvidenceCoverage
          graph={s}
          teamworkGraph={w.capabilities?.teamworkGraph}
        />
      )}
      {s ? (
        <Suspense
          fallback={
            <div className="ax-skeleton ax-skeleton--graph" role="status">
              <span className="ax-sr">Loading dependency map…</span>
            </div>
          }
        >
          <EvidenceGraph
            key={s.snapshotId}
            graph={s}
            rootId={`issue:${w.rootIssueKey}`}
            comparison={w.comparison}
            scenarioId={w.scenarioId}
          />
        </Suspense>
      ) : (
        <EmptyState
          icon="graph"
          title="No dependencies analyzed yet"
          action={
            <button
              className="ax-btn ax-btn--primary"
              onClick={() => w.actions.go("Mission Control")}
            >
              Go to Mission Control
            </button>
          }
        >
          Choose a Jira change in Mission Control and read its snapshot first.
        </EmptyState>
      )}
    </>
  );
}
