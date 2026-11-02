import { useSyncExternalStore } from "react";

/**
 * Real, in-browser timings for this session (no fake progress, nothing sent
 * anywhere). Milestones are measured from the start of this app frame's
 * navigation (`performance.timeOrigin`), so inside Jira they exclude the host
 * page's own load. Request timings are wall-clock per backend call.
 */
export interface Timing {
  kind: "milestone" | "request" | "render";
  name: string;
  ms: number;
  ok?: boolean;
  detail?: string;
}

const MAX = 200;
let entries: Timing[] = [];
const seen = new Set<string>();
const listeners = new Set<() => void>();
const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function push(t: Timing) {
  entries = [...entries, t].slice(-MAX);
  listeners.forEach((l) => l());
}

/** Records a once-per-session milestone, e.g. "First content". */
export function milestone(name: string) {
  if (seen.has(name)) return;
  seen.add(name);
  push({ kind: "milestone", name, ms: Math.round(now()) });
}

export function recordRequest(name: string, ms: number, ok: boolean) {
  push({ kind: "request", name, ms: Math.round(ms), ok });
}

export function recordRender(name: string, ms: number, detail?: string) {
  push({ kind: "render", name, ms: Math.round(ms), detail });
}

export function startTimer() {
  const t0 = now();
  return () => now() - t0;
}

export function timings() {
  return entries;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTimings() {
  return useSyncExternalStore(subscribe, timings, timings);
}

/** For tests only. */
export function resetTimings() {
  entries = [];
  seen.clear();
  listeners.forEach((l) => l());
}
