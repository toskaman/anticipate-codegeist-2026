/**
 * Read-only "what-if slip" over live Jira data, as the requesting user.
 * Walks "blocks" links outward from the slipping issue (bounded), then runs the deterministic slip engine.
 * Unreadable issues are reported as unknown, never as safe. No Jira writes.
 */
import { simulateSlip, type SlipIssue, type SlipResult } from '../../packages/simulation-core/src/slip';
import type { Ctx, JiraPort } from '../core/ports';
import { fail } from '../core/errors';

export const SLIP_MAX_ISSUES = 50;
const KEY = /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/;
const isBlocks = (phrase: string) => /\bblocks\b/i.test(phrase) && !/blocked by/i.test(phrase);

export async function slipFromJira(jira: JiraPort, ctx: Ctx, input: { issueKey: string; days: number }): Promise<SlipResult & { unreadable: string[]; truncated: boolean }> {
  if (!ctx.accountId) fail('PERMISSION_DENIED', 'An authenticated Jira account is required.');
  if (!KEY.test(input.issueKey)) fail('VALIDATION', 'issueKey must look like ABC-123');
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) fail('VALIDATION', 'days must be an integer between 1 and 365');
  const issues: SlipIssue[] = []; const blocks: { from: string; to: string }[] = []; const unreadable: string[] = [];
  const seen = new Set<string>([input.issueKey]); const queue = [input.issueKey]; let truncated = false;
  while (queue.length) {
    const k = queue.shift()!;
    const r = await jira.getIssue(k);
    if (r.kind !== 'ok') { if (k === input.issueKey) fail(r.kind === 'forbidden' ? 'PERMISSION_DENIED' : 'NOT_FOUND', `${k} cannot be read.`); unreadable.push(k); issues.push({ key: k, due: null }); continue; }
    issues.push({ key: k, due: r.issue.due ?? null, versions: (r.issue.versions ?? []).map((v) => ({ name: v.name, releaseDate: v.releaseDate })) });
    for (const l of r.issue.links) {
      const blocksOther = l.direction === 'outward' ? isBlocks(l.outward) : isBlocks(l.inward);
      if (!blocksOther) continue;
      blocks.push({ from: k, to: l.otherKey });
      if (!seen.has(l.otherKey)) { if (seen.size >= SLIP_MAX_ISSUES) { truncated = true; continue; } seen.add(l.otherKey); queue.push(l.otherKey); }
    }
  }
  const known = new Set(issues.map((i) => i.key));
  const res = simulateSlip({ issues, blocks: blocks.filter((b) => known.has(b.to)), issueKey: input.issueKey, days: input.days });
  for (const u of res.unknown) if (unreadable.includes(u.key)) u.reason = 'not readable with your Jira permissions';
  return { ...res, unreadable, truncated };
}

export function formatSlip(r: SlipResult & { unreadable: string[]; truncated: boolean }): string {
  return [`What-if: ${r.issueKey} slips ${r.days} day(s). Deterministic simulation on Jira due dates and "blocks" links; nothing was changed in Jira.`,
    `Assumptions: ${r.assumptions.join(' ')}`,
    r.moved.length ? 'Dates that move:' : 'No dated issue moves.',
    ...r.moved.map((m) => `- ${m.key}: ${m.oldDue} -> ${m.newDue} (+${m.slipDays} d) via ${m.path.join(' > ')}`),
    ...(r.absorbed.length ? ['Not affected (date unchanged):', ...r.absorbed.map((a) => `- ${a.key} (${a.due})`)] : []),
    ...(r.unknown.length ? ['Unknown (cannot be dated, not safe):', ...r.unknown.map((u) => `- ${u.key}: ${u.reason}`)] : []),
    r.releases.length ? 'Releases that would be late:' : 'No release date is crossed.',
    ...r.releases.map((x) => `- ${x.name} (${x.releaseDate}): late by ${x.lateByDays} d because of ${x.issues.join(', ')}`),
    ...(r.truncated ? [`Stopped after ${SLIP_MAX_ISSUES} issues: results beyond that are not shown.`] : [])].join('\n');
}
