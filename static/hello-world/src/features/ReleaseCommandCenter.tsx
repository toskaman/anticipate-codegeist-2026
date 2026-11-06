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

  async function load(groupIdx: number) {
    if (!projectKey) return;
    const mine = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const ov =
        overview ?? (await client.request("listReleaseSafety", { projectKey }));
      if (mine !== seq.current) return;
      setOverview(ov);
      const g = ov.releases[Math.min(groupIdx, ov.releases.length - 1)];
      if (!g) {
        setSafety(null);
        return;
      }
      setGroup(Math.min(groupIdx, ov.releases.length - 1));
      const s = await client.request("getReleaseSafety", {
        projectKey,
        fixVersion: g.fixVersion,
      });
      if (mine !== seq.current) return;
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
      if (mine !== seq.current) return;
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
    setOverview(null);
    setSafety(null);
    setAttention({});
    setGroup(0);
    setError("");
    seq.current++;
    if (projectKey && supported && safetySupported) void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

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
            onClick={() => void load(group)}
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
            onChange={(e) => void load(Number(e.target.value))}
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
