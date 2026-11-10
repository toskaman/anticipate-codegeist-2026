import React, { useId } from "react";
import type {
  GraphSnapshot,
  SimulatePortfolioResult,
} from "@anticipate/contracts";
import { verdictCopy, type Verdict } from "../app/copy";
import { Badge } from "../components/ui";

const MAX_NAMES = 6;
const rank: Record<Verdict, number> = { PASS: 0, NEEDS_REVIEW: 1, BLOCKED: 2 };

/**
 * First thing shown after a portfolio simulation: each change on its own next
 * to the combined result. Every value comes from the backend result; nothing is
 * computed beyond counting and naming what the result already lists.
 */
export default function CollisionAtAGlance({
  result: r,
  graph,
}: {
  result: SimulatePortfolioResult;
  graph: GraphSnapshot;
}) {
  const headingId = useId();
  const node = (id: string) =>
    graph.nodes.find((n) => n.id === id)?.label ?? id;
  const label = (id: string) =>
    r.individual.find((c) => c.changeId === id)?.label ?? id;
  const combined = r.combined.result.verdict;
  const emergent = r.emergentImpacts;
  const worsened = r.verdictExplanations.filter(
    (e) => rank[e.portfolioVerdict] > rank[e.standaloneVerdict],
  );
  const collided = r.conflicts.length > 0 || emergent.length > 0;
  const hero = [...worsened].sort(
    (a, b) =>
      rank[b.portfolioVerdict] - rank[a.portfolioVerdict] ||
      rank[a.standaloneVerdict] - rank[b.standaloneVerdict],
  )[0];
  const shown = emergent.slice(0, MAX_NAMES);
  return (
    <section
      className="ax-glance"
      aria-labelledby={headingId}
      data-testid="collision-at-a-glance"
    >
      <h3 id={headingId}>
        {collided ? "Collision at a glance" : "Combined result at a glance"}
      </h3>
      {hero && (
        <p className="ax-glance__hero" data-testid="collision-hero">
          <strong>{label(hero.changeId)}</strong> goes from{" "}
          {verdictCopy[hero.standaloneVerdict].label} alone to{" "}
          {verdictCopy[hero.portfolioVerdict].label} together.
          {worsened.length > 1
            ? ` ${worsened.length - 1} more change${worsened.length - 1 === 1 ? "" : "s"} also worsen${worsened.length - 1 === 1 ? "s" : ""}.`
            : ""}
        </p>
      )}
      <ol
        className="ax-glance__row"
        aria-label="Each change alone, then together"
      >
        {r.individual.map((c, i) => {
          const v = c.result.verdict;
          return (
            <li key={c.changeId} className="ax-glance__card">
              <span className="ax-glance__k">
                Change {String.fromCharCode(65 + (i % 26))} · alone
              </span>
              <strong className="ax-glance__name">{c.label}</strong>
              <Badge tone={verdictCopy[v].tone}>{verdictCopy[v].label}</Badge>
              <span className="ax-glance__n">
                {c.result.impacts.length} impacted{" "}
                {c.result.impacts.length === 1 ? "record" : "records"}
              </span>
            </li>
          );
        })}
        <li
          className={`ax-glance__card ax-glance__card--combined ax-glance__card--${combined.toLowerCase()}`}
        >
          <span className="ax-glance__k">All changes · together</span>
          <strong className="ax-glance__name">Combined result</strong>
          <Badge tone={verdictCopy[combined].tone} size="lg">
            {verdictCopy[combined].label}
          </Badge>
          <span className="ax-glance__n">
            {r.combined.result.impacts.length} impacted{" "}
            {r.combined.result.impacts.length === 1 ? "record" : "records"}
            {emergent.length ? ` · ${emergent.length} only when combined` : ""}
          </span>
        </li>
      </ol>
      {emergent.length > 0 && (
        <p className="ax-glance__emergent">
          <strong>Affected only when the changes run together: </strong>
          {shown.map((e) => node(e.nodeId)).join(" · ")}
          {emergent.length > shown.length
            ? ` · and ${emergent.length - shown.length} more`
            : ""}
          . No single change shows these records.
        </p>
      )}
      {worsened.length > 0 && (
        <ul className="ax-glance__shift">
          {worsened.map((e) => (
            <li key={e.changeId}>
              <strong>{label(e.changeId)}</strong>: alone{" "}
              {verdictCopy[e.standaloneVerdict].label}, together{" "}
              {verdictCopy[e.portfolioVerdict].label}.
            </li>
          ))}
        </ul>
      )}
      <p className="ax-glance__next">
        <strong>Next: </strong>
        {r.conflicts.length > 0
          ? `Read the ${r.conflicts.length === 1 ? "collision explanation" : `${r.conflicts.length} collision explanations`} below, then compare safer alternatives. Nothing has been changed in Jira.`
          : emergent.length > 0
            ? "Review the records affected only in combination with their owners. Nothing has been changed in Jira."
            : "No collision was reported in this snapshot. That is not proof the changes are safe together; review the details below."}
      </p>
    </section>
  );
}
