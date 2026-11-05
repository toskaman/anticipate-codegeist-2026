/**
 * Release Safety Control Plane (read-only). Pure aggregation: Jira change issues of a release + the caller's own
 * recorded decisions -> one state per change, structural interactions between changes, and a release verdict.
 *
 * Correctness rules:
 * - Unknown is never safe: no decision, unreadable evidence or truncated search can only make the verdict worse.
 * - VERIFIED_FOR_RECORDED_SCOPE means "every change has a completed, verified, unblocked decision", never "release is safe".
 * - Interactions are structural signals (direct link / shared neighbour), not simulated conflicts: they ask for a
 *   Portfolio simulation, they never claim one.
 * - Decisions owned by someone else are not visible here (plans are private), exactly like the rest of the app.
 */
import type { ReleaseOverview, ReleaseSafety, ReleaseSafetyItem, ReleaseVerdict } from '../../packages/contracts/src/index';
import { RELEASE_SAFETY_LIMITS } from '../../packages/contracts/src/index';
import type { JiraIssue } from '../core/ports';
import type { DecisionRecord } from '../validator';

/** Worst first. The release verdict is the worst item state (plus coverage penalties). */
export const VERDICT_ORDER: ReleaseVerdict[] = ['BLOCKED', 'EVIDENCE_INCOMPLETE', 'NEEDS_REVIEW', 'EXECUTION_PARTIAL', 'APPROVED_NOT_EXECUTED', 'VERIFIED_FOR_RECORDED_SCOPE'];
const rank = (v: ReleaseVerdict) => VERDICT_ORDER.indexOf(v);
const worst = (a: ReleaseVerdict, b: ReleaseVerdict) => (rank(a) <= rank(b) ? a : b);

export interface ReleaseInput {
  projectKey: string; fixVersion: string | null; jql: string; evaluatedAt: string;
  issues: JiraIssue[]; truncated: boolean; siteUrl: string | null;
  /** Decision visible to the caller per issue key (undefined = none recorded or not the caller's). */
  decisions: Record<string, DecisionRecord | undefined>;
}

export function classify(issue: JiraIssue, d: DecisionRecord | undefined, now: Date): { state: ReleaseVerdict; reasons: string[] } {
  if (!d) return { state: 'NEEDS_REVIEW', reasons: ['No ANTICIPATE decision of yours is recorded for this change.'] };
  const reasons: string[] = [];
  if (d.status === 'EVIDENCE_CHANGED' || d.status === 'INVALIDATED')
    return { state: 'BLOCKED', reasons: [`Decision ${d.planId} is ${d.status}: Jira evidence changed after it was made; it cannot authorize execution.`] };
  if (d.status === 'EXPIRED' || d.status === 'FAILED')
    return { state: 'NEEDS_REVIEW', reasons: [`Decision ${d.planId} is ${d.status}; a new decision is required.`] };
  const verdict = d.currentVerdict ?? d.verdict ?? 'UNKNOWN';
  if (verdict === 'BLOCK') return { state: 'BLOCKED', reasons: [`Policy verdict BLOCK${d.currentVerdict ? ' on live evidence at completion' : ''} (${d.currentBlockers ?? d.blockers ?? '?'} blocker(s)).`] };
  if (verdict === 'UNKNOWN') reasons.push('Policy verdict is UNKNOWN: evidence was incomplete when the decision was made.');
  if (d.status === 'COMPLETED' && d.validUntil && new Date(d.validUntil).getTime() < now.getTime())
    return { state: 'NEEDS_REVIEW', reasons: [`Attestation for ${d.planId} expired on ${d.validUntil.slice(0, 10)}.`] };
  let state: ReleaseVerdict;
  if (d.status === 'COMPLETED' && d.allActionsVerified) state = 'VERIFIED_FOR_RECORDED_SCOPE';
  else if (d.status === 'PARTIAL' || d.status === 'EXECUTING' || d.status === 'COMPLETED') { state = 'EXECUTION_PARTIAL'; reasons.push('Not every planned action was verified in Jira.'); }
  else if (d.status === 'APPROVED') { state = 'APPROVED_NOT_EXECUTED'; reasons.push('Approved; prevention actions not executed yet.'); }
  else { state = 'NEEDS_REVIEW'; reasons.push(`Decision ${d.planId} is ${d.status}; awaiting approval.`); }
  if (verdict === 'UNKNOWN') state = worst(state, 'EVIDENCE_INCOMPLETE');
  if (state === 'VERIFIED_FOR_RECORDED_SCOPE') reasons.push(`Verified actions for plan ${d.planId} (scope recorded at ${d.at.slice(0, 10)}).`);
  if (issue.links.length === 0) reasons.push('No Jira links on this issue: dependencies may simply be unrecorded.');
  return { state, reasons: reasons.slice(0, 6) };
}

export function aggregateRelease(input: ReleaseInput): ReleaseSafety {
  const now = new Date(input.evaluatedAt);
  const issues = [...input.issues].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
  const site = input.siteUrl ? input.siteUrl.replace(/\/$/, '') : null;
  const items: ReleaseSafetyItem[] = issues.slice(0, RELEASE_SAFETY_LIMITS.maxItems).map((i) => {
    const d = input.decisions[i.key];
    const c = classify(i, d, now);
    return {
      issue: { key: i.key, summary: i.summary.slice(0, 1000), status: i.status.slice(0, 100), url: site ? `${site}/browse/${i.key}` : null },
      state: c.state, reasons: c.reasons.map((r) => r.slice(0, 300)),
      decision: d ? { planId: d.planId, status: d.status, verdict: d.verdict ?? 'UNKNOWN', currentVerdict: d.currentVerdict ?? null, recordedAt: d.at,
        allActionsVerified: !!d.allActionsVerified } : null,
      linkedKeys: [...new Set(i.links.map((l) => l.otherKey))].sort().slice(0, 50)
    };
  });

  // Structural interactions between changes of the same release (deterministic, pair-ordered).
  const keys = new Set(issues.map((i) => i.key));
  const pairs = new Map<string, { kind: 'DIRECT_LINK' | 'SHARED_DEPENDENCY'; a: string; b: string; via: string | null }>();
  const neighbours = new Map<string, string[]>();
  for (const i of issues) for (const l of i.links) {
    if (keys.has(l.otherKey) && l.otherKey !== i.key) {
      const [a, b] = [i.key, l.otherKey].sort();
      pairs.set(`${a}|${b}|`, { kind: 'DIRECT_LINK', a: a!, b: b!, via: null });
    } else if (!keys.has(l.otherKey)) {
      const arr = neighbours.get(l.otherKey) ?? []; if (!arr.includes(i.key)) arr.push(i.key); neighbours.set(l.otherKey, arr);
    }
  }
  for (const [via, users] of [...neighbours.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    const u = [...users].sort();
    for (let x = 0; x < u.length; x++) for (let y = x + 1; y < u.length; y++) {
      const id = `${u[x]}|${u[y]}|${via}`;
      if (!pairs.has(`${u[x]}|${u[y]}|`)) pairs.set(id, { kind: 'SHARED_DEPENDENCY', a: u[x]!, b: u[y]!, via });
    }
  }
  const allPairs = [...pairs.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([, p]) => p);
  const interactions = allPairs.slice(0, RELEASE_SAFETY_LIMITS.maxInteractions).map((p) => ({
    kind: p.kind, changes: [p.a, p.b] as [string, string], via: p.via,
    note: p.kind === 'DIRECT_LINK' ? `${p.a} and ${p.b} are linked to each other in Jira: review them together (Portfolio simulation).`
      : `${p.a} and ${p.b} both touch ${p.via}: their combined effect is not covered by either decision alone (Portfolio simulation).`
  }));

  const counts = Object.fromEntries(VERDICT_ORDER.map((v) => [v, 0])) as Record<ReleaseVerdict, number>;
  for (const it of items) counts[it.state]++;
  const unknowns: string[] = [];
  if (input.truncated) unknowns.push(`Search stopped at ${RELEASE_SAFETY_LIMITS.maxIssues} issues: changes beyond that are not evaluated.`);
  if (issues.length > items.length) unknowns.push(`${issues.length - items.length} change(s) not listed (display limit).`);
  unknowns.push('Only Jira issues labelled "anticipate-change" that you can browse are evaluated; unlabelled or unreadable changes are invisible here.');
  unknowns.push("Other users' private decisions are not visible to you and are counted as missing.");

  let verdict: ReleaseVerdict = items.reduce<ReleaseVerdict>((acc, it) => worst(acc, it.state), 'VERIFIED_FOR_RECORDED_SCOPE');
  const verdictReasons: string[] = [];
  if (items.length === 0) { verdict = 'EVIDENCE_INCOMPLETE'; verdictReasons.push(input.fixVersion ? `No change issues found in ${input.projectKey} for release "${input.fixVersion}".` : `No change issues found in ${input.projectKey}.`); }
  if (input.truncated) { verdict = worst(verdict, 'EVIDENCE_INCOMPLETE'); verdictReasons.push('Change list truncated: the verdict cannot cover the whole release.'); }
  if (interactions.length && rank(verdict) > rank('NEEDS_REVIEW')) { verdict = 'NEEDS_REVIEW'; verdictReasons.push(`${allPairs.length} interaction(s) between changes need a combined review.`); }
  for (const v of VERDICT_ORDER) if (counts[v]) verdictReasons.push(`${counts[v]} change(s) ${v}.`);
  if (verdict === 'VERIFIED_FOR_RECORDED_SCOPE') verdictReasons.push('Verified only for the recorded scope of each decision; this is not a guarantee that the release is safe.');

  return {
    scope: { projectKey: input.projectKey, fixVersion: input.fixVersion, jql: input.jql.slice(0, 500), evaluatedAt: input.evaluatedAt },
    verdict, verdictReasons: verdictReasons.slice(0, 8).map((r) => r.slice(0, 300)), counts, items, interactions,
    coverage: { issuesRead: input.issues.length, truncated: input.truncated, interactionsTruncated: allPairs.length > interactions.length,
      decisionsVisible: items.filter((i) => i.decision).length, unknowns: unknowns.slice(0, 8) },
    readOnly: true
  };
}

/**
 * Release overview: one aggregateRelease per fixVersion (and one for unscheduled changes), worst verdict first, then
 * earliest release date, then name. A change in several versions counts in each. Same truncation honesty as one release.
 */
export function overviewReleases(i: Omit<ReleaseInput, 'fixVersion'>): ReleaseOverview {
  const groups = new Map<string, { name: string | null; date: string | null; issues: JiraIssue[] }>();
  for (const issue of i.issues) {
    const vs = issue.versions ?? [];
    if (!vs.length) { const g = groups.get('\u0000') ?? { name: null, date: null, issues: [] }; g.issues.push(issue); groups.set('\u0000', g); }
    for (const v of vs) { const g = groups.get(v.name) ?? { name: v.name, date: v.releaseDate, issues: [] }; g.issues.push(issue); groups.set(v.name, g); }
  }
  const all = [...groups.values()].map((g) => {
    const r = aggregateRelease({ ...i, fixVersion: g.name, issues: g.issues });
    return { fixVersion: g.name, releaseDate: g.date, verdict: r.verdict, counts: r.counts, changes: r.items.length, interactions: r.interactions.length,
      topReasons: r.verdictReasons.slice(0, 3) };
  }).sort((a, b) => rank(a.verdict) - rank(b.verdict) || (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999')
    || (a.fixVersion ?? '\uffff').localeCompare(b.fixVersion ?? '\uffff'));
  const unknowns = ['Release membership comes from the fixVersions of change issues you can read; releases without such issues are not listed.'];
  if (i.truncated) unknowns.push(`Search stopped at ${RELEASE_SAFETY_LIMITS.maxIssues} change issues: every release verdict here is at best EVIDENCE_INCOMPLETE.`);
  return { projectKey: i.projectKey, evaluatedAt: i.evaluatedAt, jql: i.jql.slice(0, 500), releases: all.slice(0, 50), truncated: i.truncated,
    releasesTruncated: all.length > 50, unknowns, readOnly: true };
}
