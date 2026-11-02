/**
 * Continuous Decision Safety: compares the dependency structure a plan was approved on with a fresh, bounded
 * re-extraction of the same evidence neighbourhood. Pure diff — no I/O here.
 * Only causal edges (DEPENDS_ON / USES / BLOCKS) and readability changes count; timestamps, labels and comments do not,
 * so ANTICIPATE's own labels/comments never trigger a false alarm. Issues created by the plan's own verified actions are ignored.
 */
import type { EvidenceDrift, GraphSnapshot } from '../../packages/contracts/src/index';

const CAUSAL = new Set(['DEPENDS_ON', 'USES', 'BLOCKS']);
type E = GraphSnapshot['edges'][number];
const key = (e: E) => `${e.from}|${e.kind}|${e.to}`;
const slim = (e: E) => ({ from: e.from, to: e.to, kind: e.kind, status: e.status });

export function diffEvidence(args: { planId: string; before: GraphSnapshot; after: GraphSnapshot; planArtifactIssueKeys: string[]; checkedAt: string }): EvidenceDrift {
  const ignore = new Set(args.planArtifactIssueKeys.map((k) => `issue:${k}`));
  const relevant = (e: E) => CAUSAL.has(e.kind) && !ignore.has(e.from) && !ignore.has(e.to);
  const b = new Map(args.before.edges.filter(relevant).map((e) => [key(e), e]));
  const a = new Map(args.after.edges.filter(relevant).map((e) => [key(e), e]));
  const addedEdges = [...a].filter(([k]) => !b.has(k)).map(([, e]) => slim(e)).sort((x, y) => key(x as E).localeCompare(key(y as E)));
  const removedEdges = [...b].filter(([k]) => !a.has(k)).map(([, e]) => slim(e)).sort((x, y) => key(x as E).localeCompare(key(y as E)));
  const wasKnown = new Set(args.before.nodes.filter((n) => n.status !== 'UNKNOWN').map((n) => n.id));
  const becameUnknown = args.after.nodes.filter((n) => n.status === 'UNKNOWN' && wasKnown.has(n.id) && !ignore.has(n.id)).map((n) => n.id).sort();
  const fresh = !addedEdges.length && !removedEdges.length && !becameUnknown.length && !(args.after.truncated && !args.before.truncated);
  const parts = [
    addedEdges.length ? `${addedEdges.length} new dependency relation(s)` : '',
    removedEdges.length ? `${removedEdges.length} removed relation(s)` : '',
    becameUnknown.length ? `${becameUnknown.length} item(s) no longer readable` : '',
    args.after.truncated && !args.before.truncated ? 'evidence now exceeds crawl limits' : ''
  ].filter(Boolean);
  return {
    planId: args.planId, snapshotId: args.before.snapshotId, checkedAt: args.checkedAt, fresh,
    addedEdges: addedEdges.slice(0, 500), removedEdges: removedEdges.slice(0, 500), becameUnknown: becameUnknown.slice(0, 500),
    ignoredPlanArtifacts: args.planArtifactIssueKeys.slice(0, 100),
    reason: fresh ? 'Live Jira evidence matches the evidence this plan was approved on.' : `Evidence changed since the snapshot: ${parts.join(', ')}. Re-run the comparison and review a new plan.`
  };
}
