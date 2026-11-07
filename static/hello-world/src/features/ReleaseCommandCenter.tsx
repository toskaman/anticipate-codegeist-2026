import React, { useEffect, useRef, useState } from "react";
import type {
  PlanAttention,
  ReleaseOverview,
  ReleaseSafety as ReleaseSafetyResult,
} from "@anticipate/contracts";
import { CoreClientError, type ForgeClient } from "../api/ForgeClient";
import { Badge, Notice, Panel, SourceLink } from "../components/ui";
import { verdictMeta } from "./ReleaseSafety";
import { nextActionForItem, nextActionForRelease } from "../app/releaseNext";

/** Attention is fetched per recorded decision; bounded so one release cannot fan out. */
const ATTENTION_MAX_ITEMS = 10;

export interface ReleaseCommandCenterProps {
  client: Pick<ForgeClient, "request">;
  projectKey: string | null;
  supported: boolean;
  safetySupported: boolean;
  /** Starts the normal analysis of a change (same as Release Safety review). */
  onReview?(issueKey: string): void;
}

/**
 * Enterprise Release Command Center: one release-decision surface. Read-only;
 * composes the existing overview, safety and plan-attention operations and derives
 * the next permissible action from recorded state. Never shows another user's
 * private decisions (the backend scopes every op to the caller).
 */
export default function ReleaseCommandCenter({
  client,
  projectKey,
  supported,
  safetySupported,
  onReview,
}: ReleaseCommandCenterProps) {
  const [overview, setOverview] = useState<ReleaseOverview | null>(null);
  const [group, setGroup] = useState(0);
  const [safety, setSafety] = useState<ReleaseSafetyResult | null>(null);
  const [attention, setAttention] = useState<
    Record<string, PlanAttention | null>
  >({});
  const [attentionCapped, setAttentionCapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  /** Overviews cached per project: a cached overview only ever serves its own project. */
  const overviews = useRef(new Map<string, ReleaseOverview>());
  /** Latest requested project: every late response is checked against it. */
  const keyRef = useRef(projectKey);
  keyRef.current = projectKey;

  /**
   * Loads one project's release digest. Identity comes only from parameters
   * (project key + release index + request generation): shared state is never
   * read as a cache, so a project switch cannot reuse another project's data.
   */
  async function loadFor(key: string, groupIdx: number, mine: number) {
    setBusy(true);
    setError("");
    try {
      let ov = overviews.current.get(key);
      if (!ov) {
        ov = await client.request("listReleaseSafety", { projectKey: key });
        if (mine !== seq.current || keyRef.current !== key) return;
        if (ov.projectKey !== key)
          throw new CoreClientError(
            "INVALID_RESPONSE",
            "Release overview belongs to another project.",
          );
        if (overviews.current.size >= 10) overviews.current.clear();
        overviews.current.set(key, ov);
      } else if (mine !== seq.current || keyRef.current !== key) {
        return;
      }
      setOverview(ov);
      const g = ov.releases[Math.min(groupIdx, ov.releases.length - 1)];
      if (!g) {
        setSafety(null);
        return;
      }
      setGroup(Math.min(groupIdx, ov.releases.length - 1));
      const s = await client.request("getReleaseSafety", {
        projectKey: key,
        fixVersion: g.fixVersion,
      });
      if (mine !== seq.current || keyRef.current !== key) return;
      setSafety(s);
      const decided = s.items.filter((i) => i.decision);
      setAttentionCapped(decided.length > ATTENTION_MAX_ITEMS);
      const settled = await Promise.all(
        decided.slice(0, ATTENTION_MAX_ITEMS).map(async (i) => {
          try {
            const a = await client.request("getPlanAttention", {
              planId: i.decision!.planId,
            });
            return [i.decision!.planId, a] as const;
          } catch {
            return [i.decision!.planId, null] as const;
          }
        }),
      );
      if (mine !== seq.current || keyRef.current !== key) return;
      setAttention(Object.fromEntries(settled));
    } catch (e) {
      if (mine !== seq.current) return;
      setSafety(null);
      setError(
        e instanceof CoreClientError
          ? e.message
          : "Release data could not be read. Nothing was changed.",
      );
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  useEffect(() => {
    seq.current++;
    setOverview(null);
    setSafety(null);
    setAttention({});
    setAttentionCapped(false);
    setGroup(0);
    setError("");
    setBusy(false);
    if (projectKey && supported && safetySupported) {
      const mine = ++seq.current;
      void loadFor(projectKey, 0, mine);
    }
    return () => {
      // Invalidate in-flight responses on unmount or re-subscription.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, supported, safetySupported, client]);

  if (!supported || !safetySupported) return null;
  const stalePlans = safety
    ? safety.items.filter(
        (i) => i.decision && attention[i.decision.planId]?.needsReview === true,
      ).length
    : 0;
  const releaseAction =
    safety &&
    nextActionForRelease({
      verdict: safety.verdict,
      counts: safety.counts,
      interactions: safety.interactions.length,
      unknowns: safety.coverage.unknowns.length,
      stalePlans,
    });

  return (
    <Panel
      id="release-command-center-title"
      title="Release Command Center"
      description="What is blocked, what interacts, what is stale, and what to do next — read-only."
      actions={
        <Badge tone="info" icon="target" size="sm">
          Read-only digest
        </Badge>
      }
    >
      {busy && (
        <p role="status" className="ax-muted">
          Reading release data…
        </p>
      )}
      {error && (
        <Notice tone="danger" role="alert" title="Release data unavailable">
          {error}{" "}
          <button
            className="ax-btn ax-btn--ghost"
            onClick={() => {
              if (!projectKey) return;
              const mine = ++seq.current;
              void loadFor(projectKey, group, mine);
            }}
          >
            Try again
          </button>
        </Notice>
      )}
      {overview && overview.releases.length === 0 && !busy && (
        <p className="ax-muted">No releases with changes in this project.</p>
      )}
      {overview && overview.releases.length > 0 && (
        <label>
          Release{" "}
          <select
            value={group}
            onChange={(e) => {
              if (!projectKey) return;
              const mine = ++seq.current;
              void loadFor(projectKey, Number(e.target.value), mine);
            }}
          >
            {overview.releases.map((g, i) => (
              <option key={g.fixVersion ?? `unscheduled-${i}`} value={i}>
                {g.fixVersion ?? "Unscheduled"} · {g.changes} change(s)
              </option>
            ))}
          </select>
        </label>
      )}
      {safety && releaseAction && (
        <Notice
          tone={releaseAction.kind === "none" ? "success" : "warning"}
          title={`Next: ${releaseAction.label}`}
        >
          {releaseAction.detail}
        </Notice>
      )}
      {safety && (
        <div className="ax-table-wrap">
          <table className="ax-table">
            <caption className="ax-sr">
              Changes in this release with decision state and next action
            </caption>
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">State</th>
                <th scope="col">Decision</th>
                <th scope="col">Attention</th>
                <th scope="col">Next action</th>
              </tr>
            </thead>
            <tbody>
              {safety.items.map((item) => {
                const att = item.decision
                  ? (attention[item.decision.planId] ?? undefined)
                  : null;
                const action = nextActionForItem(
                  item,
                  att === null || att === undefined ? null : att,
                );
                return (
                  <tr key={item.issue.key}>
                    <td>
                      <SourceLink url={item.issue.url}>
                        {item.issue.key}
                      </SourceLink>
                    </td>
                    <td>
                      <Badge tone={verdictMeta(item.state).tone} size="sm">
                        {verdictMeta(item.state).label}
                      </Badge>
                    </td>
                    <td>
                      {item.decision
                        ? `${item.decision.status} · ${item.decision.currentVerdict ?? item.decision.verdict}`
                        : "No recorded decision"}
                    </td>
                    <td>
                      {!item.decision ? (
                        <span className="ax-muted">—</span>
                      ) : att === undefined ? (
                        <span className="ax-muted">Reading…</span>
                      ) : att === null ? (
                        <span className="ax-muted">Unavailable</span>
                      ) : att.needsReview ? (
                        <Badge tone="danger" size="sm">
                          Needs re-check
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm">
                          Fresh
                        </Badge>
                      )}
                    </td>
                    <td>
                      {action.label}{" "}
                      {onReview && action.kind !== "none" && (
                        <button
                          type="button"
                          className="ax-link-btn"
                          onClick={() => onReview(item.issue.key)}
                        >
                          Analyze {item.issue.key}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {safety && safety.coverage.unknowns.length > 0 && (
        <Notice tone="warning" title="Unknown evidence in this release">
          <ul>
            {safety.coverage.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </Notice>
      )}
      {attentionCapped && (
        <p className="ax-muted">
          Attention shown for the first {ATTENTION_MAX_ITEMS} recorded
          decisions; the rest were not checked.
        </p>
      )}
      {safety?.coverage.truncated && (
        <p className="ax-muted">
          Change list truncated at the backend bound; omitted changes are not
          assumed clear.
        </p>
      )}
    </Panel>
  );
}
