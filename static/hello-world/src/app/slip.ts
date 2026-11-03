// View model for CORE's simulateSlip result (what-if a Jira issue slips).
// Pure: ordering and wording only; the backend computes every date.
import type { SlipSimulation } from "@anticipate/contracts";

export const SLIP_CAPABILITY = "simulateSlip";

export interface SlipView {
  headline: string;
  lateReleases: SlipSimulation["releases"];
  onTimeReleases: SlipSimulation["releases"];
  moved: SlipSimulation["moved"];
  absorbed: SlipSimulation["absorbed"];
  unknown: SlipSimulation["unknown"];
  unreadable: string[];
  assumptions: string[];
  truncated: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "ABC-1 → ABC-2 → ABC-4": how the slip travels, starting at the slipped issue. */
export function pathText(path: string[]) {
  return path.join(" → ");
}

export function slipView(r: SlipSimulation): SlipView {
  const byLate = [...r.releases].sort(
    (a, b) => b.lateByDays - a.lateByDays || a.name.localeCompare(b.name),
  );
  const lateReleases = byLate.filter((x) => x.lateByDays > 0);
  const onTimeReleases = byLate.filter((x) => x.lateByDays <= 0);
  const moved = [...r.moved].sort(
    (a, b) => b.slipDays - a.slipDays || a.key.localeCompare(b.key),
  );
  const parts = [
    lateReleases.length
      ? `${plural(lateReleases.length, "release")} would be late`
      : "no release would be late",
    `${plural(moved.length, "due date")} would move`,
  ];
  const unknownCount = r.unknown.length + r.unreadable.length;
  if (unknownCount)
    parts.push(`${plural(unknownCount, "item")} cannot be assessed`);
  return {
    headline: `If ${r.issueKey} slips ${plural(r.days, "day")}: ${parts.join(", ")}.`,
    lateReleases,
    onTimeReleases,
    moved,
    absorbed: r.absorbed,
    unknown: r.unknown,
    unreadable: r.unreadable,
    assumptions: r.assumptions,
    truncated: r.truncated,
  };
}

/** Days input: whole number from 1 to 365, else null. */
export function parseSlipDays(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= 365 ? n : null;
}
