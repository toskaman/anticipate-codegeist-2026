/**
 * What-if slip simulation (deterministic, no probabilities).
 * Question: "If issue X slips by N days, which planned dates and releases move?"
 * Model (stated to the user as assumptions):
 *  A1. A "blocks" link means the dependent cannot finish before its blocker finishes.
 *  A2. Each dependent keeps the planned gap between its blocker's due date and its own due date (its own work does not shrink).
 *      So the new due date of a dependent is max(its due date, new due date of the blocker + max(0, planned gap)).
 *  A3. Only Jira due dates are used; an issue without a due date cannot be dated and is reported as UNKNOWN, never as safe.
 *  A4. A release (fix version) is late when any of its issues' new due date is after the release date.
 * Same input → same output (sorted, hashable).
 */
export interface SlipIssue { key: string; due: string | null; versions?: { name: string; releaseDate: string | null }[] }
export interface SlipInput { issues: SlipIssue[]; blocks: { from: string; to: string }[]; issueKey: string; days: number }
export interface SlipResult {
  issueKey: string; days: number; assumptions: string[];
  moved: { key: string; oldDue: string; newDue: string; slipDays: number; path: string[] }[];
  absorbed: { key: string; due: string; path: string[] }[];
  unknown: { key: string; reason: string; path: string[] }[];
  releases: { name: string; releaseDate: string; lateByDays: number; issues: string[] }[];
}
const DAY = 86400000;
const d = (s: string) => Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function simulateSlip(input: SlipInput): SlipResult {
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) throw new Error('days must be an integer between 1 and 365');
  const byKey = new Map(input.issues.map((i) => [i.key, i]));
  const root = byKey.get(input.issueKey);
  if (!root) throw new Error(`unknown issue ${input.issueKey}`);
  const out = new Map<string, string[]>();
  for (const e of input.blocks) { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from)!.push(e.to); }
  for (const v of out.values()) v.sort();
  const res: SlipResult = { issueKey: input.issueKey, days: input.days, assumptions: [
    'A blocks link means the dependent cannot finish before its blocker.',
    'Each dependent keeps its planned gap after its blocker (its own work does not shrink).',
    'Only Jira due dates are used; issues without a due date are UNKNOWN, not safe.',
    'A release is late when one of its issues moves past the release date.'], moved: [], absorbed: [], unknown: [], releases: [] };
  // newDue: null = unknown. Longest-path relaxation over a DAG in BFS order; cycles are reported as unknown.
  const newDue = new Map<string, number | null>();
  const pathOf = new Map<string, string[]>();
  newDue.set(root.key, root.due ? d(root.due) + input.days * DAY : null);
  pathOf.set(root.key, [root.key]);
  const queue = [root.key]; const visits = new Map<string, number>();
  while (queue.length) {
    const k = queue.shift()!;
    visits.set(k, (visits.get(k) ?? 0) + 1);
    if (visits.get(k)! > input.issues.length + 1) { res.unknown.push({ key: k, reason: 'dependency cycle', path: pathOf.get(k)! }); continue; }
    const from = byKey.get(k)!; const fromNew = newDue.get(k) ?? null;
    for (const t of out.get(k) ?? []) {
      const to = byKey.get(t); if (!to) continue;
      let cand: number | null;
      if (fromNew === null || !to.due || !from.due) cand = null;
      else cand = Math.max(d(to.due), fromNew + Math.max(0, d(to.due) - d(from.due)));
      const prev = newDue.get(t);
      const better = prev === undefined || (prev !== null && (cand === null || cand > prev));
      if (better) { newDue.set(t, cand); pathOf.set(t, [...pathOf.get(k)!, t]); queue.push(t); }
    }
  }
  for (const [k, nd] of [...newDue.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const it = byKey.get(k)!;
    if (res.unknown.some((u) => u.key === k)) continue;
    if (nd === null || !it.due) { res.unknown.push({ key: k, reason: it.due ? 'a blocker on the path has no due date' : 'no due date in Jira', path: pathOf.get(k)! }); continue; }
    const slip = Math.round((nd - d(it.due)) / DAY);
    if (slip > 0) res.moved.push({ key: k, oldDue: iso(d(it.due)), newDue: iso(nd), slipDays: slip, path: pathOf.get(k)! });
    else res.absorbed.push({ key: k, due: iso(d(it.due)), path: pathOf.get(k)! });
  }
  const rel = new Map<string, { date: number; late: number; issues: Set<string> }>();
  for (const m of res.moved) for (const v of byKey.get(m.key)!.versions ?? []) {
    if (!v.releaseDate) continue;
    const late = Math.round((d(m.newDue) - d(v.releaseDate)) / DAY);
    if (late <= 0) continue;
    const r = rel.get(v.name) ?? { date: d(v.releaseDate), late: 0, issues: new Set<string>() };
    r.late = Math.max(r.late, late); r.issues.add(m.key); rel.set(v.name, r);
  }
  res.releases = [...rel.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, r]) => ({ name, releaseDate: iso(r.date), lateByDays: r.late, issues: [...r.issues].sort() }));
  return res;
}
