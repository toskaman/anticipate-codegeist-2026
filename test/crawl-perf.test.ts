/**
 * P1-crawl-perf: Jira crawls must fetch with bounded parallelism and cache snapshots per key.
 * Failing-test-first: parallelism assertions (>1 in-flight) fail on the old sequential code.
 */
import { extractGraph, CRAWL_FETCH_CONCURRENCY, createIssueCache, fetchIssues } from '../src/jira/extractor';
import { slipFromJira, SLIP_MAX_ISSUES } from '../src/engine/slip-service';
import { previewSample, createSample } from '../src/engine/sample';
import { FakeJira } from './fakes';

/** FakeJira with latency + in-flight tracking to observe fetch concurrency. */
class InstrumentedJira extends FakeJira {
  active = 0;
  maxActive = 0;
  getIssueCalls = 0;
  searchIssuesCalls = 0;
  delayMs = 5;
  private async track<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await new Promise((r) => setTimeout(r, this.delayMs));
      return await fn();
    } finally {
      this.active--;
    }
  }
  async getIssue(key: string) {
    this.getIssueCalls++;
    return this.track(() => super.getIssue(key));
  }
  async searchIssues(jql: string) {
    this.searchIssuesCalls++;
    return this.track(() => super.searchIssues(jql));
  }
  resetCounters() {
    this.active = 0;
    this.maxActive = 0;
    this.getIssueCalls = 0;
    this.searchIssuesCalls = 0;
  }
}

const NOW = new Date('2026-11-02T09:00:00Z');
const ctx = { requestId: 'r', accountId: 'u1', installationId: 'i' };

function fanout(j: FakeJira, root: string, n: number, due: string | null = null) {
  j.add(root, `${root} root`, due ? { due } : {});
  for (let i = 2; i <= n + 1; i++) {
    const c = `${root.split('-')[0]}-${i}`;
    j.add(c, `${c} child`, due ? { due } : {});
    j.link('Blocks', 'blocks', 'is blocked by', root, c);
  }
}

describe('crawl perf: extractor', () => {
  it('fetches a wide frontier in parallel within a bound of 5-10', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'W-1', 12);
    const snap = await extractGraph(j, 'W-1', { maxDepth: 2, maxNodes: 100, snapshotId: 't', projectId: 'W', now: NOW, ttlHours: 1 });
    expect(snap.nodes).toHaveLength(13);
    expect(j.maxActive).toBeGreaterThan(1); // sequential code stays at 1
    expect(j.maxActive).toBeLessThanOrEqual(CRAWL_FETCH_CONCURRENCY);
    expect(CRAWL_FETCH_CONCURRENCY).toBeGreaterThanOrEqual(5);
    expect(CRAWL_FETCH_CONCURRENCY).toBeLessThanOrEqual(10);
  });

  it('preserves order and determinism across runs', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'W-1', 12);
    const o = { maxDepth: 2, maxNodes: 100, snapshotId: 't', projectId: 'W', now: NOW, ttlHours: 1 };
    const a = await extractGraph(j, 'W-1', o);
    const b = await extractGraph(j, 'W-1', o);
    expect(a).toEqual(b);
    expect(a.nodes.map((n) => n.id)).toEqual([...a.nodes.map((n) => n.id)].sort());
    expect(a.edges.map((e) => e.id)).toEqual([...a.edges.map((e) => e.id)].sort());
  });

  it('still respects maxDepth and maxNodes', async () => {
    const j = new InstrumentedJira();
    j.add('D-1', 'd1'); j.add('D-2', 'd2'); j.add('D-3', 'd3');
    j.link('Blocks', 'blocks', 'is blocked by', 'D-1', 'D-2');
    j.link('Blocks', 'blocks', 'is blocked by', 'D-2', 'D-3');
    const depth = await extractGraph(j, 'D-1', { maxDepth: 1, maxNodes: 100, snapshotId: 't', projectId: 'D', now: NOW, ttlHours: 1 });
    expect(depth.truncated).toBe(true);
    expect(depth.nodes.find((n) => n.id === 'issue:D-3')?.status).toBe('UNKNOWN');

    const w = new InstrumentedJira();
    fanout(w, 'W-1', 12);
    const capped = await extractGraph(w, 'W-1', { maxDepth: 2, maxNodes: 5, snapshotId: 't', projectId: 'W', now: NOW, ttlHours: 1 });
    expect(capped.truncated).toBe(true);
    expect(capped.nodes.length).toBeLessThanOrEqual(5);
  });
});

describe('crawl perf: slip-service', () => {
  it('fetches downstream blocks in parallel within a bound of 5-10', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'S-1', 12, '2027-06-01');
    const r = await slipFromJira(j, ctx, { issueKey: 'S-1', days: 2 });
    expect(j.maxActive).toBeGreaterThan(1); // sequential code stays at 1
    expect(j.maxActive).toBeLessThanOrEqual(CRAWL_FETCH_CONCURRENCY);
    const keys = [...r.moved.map((m) => m.key), ...r.absorbed.map((a) => a.key), ...r.unknown.map((u) => u.key)].sort();
    expect(keys).toHaveLength(13);
    expect(r.moved.map((m) => m.key)).toContain('S-1');
  });

  it('is deterministic and still respects SLIP_MAX_ISSUES', async () => {
    const j = new InstrumentedJira();
    for (let i = 1; i <= 60; i++) j.add(`L-${i}`, `l${i}`, { due: '2027-01-01' });
    for (let i = 1; i < 60; i++) j.link('Blocks', 'blocks', 'is blocked by', `L-${i}`, `L-${i + 1}`);
    const a = await slipFromJira(j, ctx, { issueKey: 'L-1', days: 2 });
    const b = await slipFromJira(j, ctx, { issueKey: 'L-1', days: 2 });
    expect(a).toEqual(b);
    expect(a.truncated).toBe(true);
    expect(a.moved.length + a.absorbed.length + a.unknown.length).toBeLessThanOrEqual(SLIP_MAX_ISSUES);
  });
});

describe('crawl perf: sample inspect', () => {
  it('parallelizes reads and dedupes link-target fetches', async () => {
    const j = new InstrumentedJira();
    j.add('JDG-1', 'existing customer issue');
    await createSample(j, 'JDG');
    j.resetCounters();
    const p1 = await previewSample(j, 'JDG');
    expect(j.searchIssuesCalls).toBe(6);
    expect(j.getIssueCalls).toBe(2); // api + checkout; sequential N+1 code fetches 4
    expect(j.maxActive).toBeGreaterThan(1); // sequential code stays at 1
    expect(j.maxActive).toBeLessThanOrEqual(CRAWL_FETCH_CONCURRENCY);
    expect(p1.links.every((l) => l.status === 'EXISTS')).toBe(true);
    const p2 = await previewSample(j, 'JDG');
    expect(p2).toEqual(p1);
  });
});

describe('crawl perf: snapshot cache', () => {
  it('fetchIssues dedupes keys, keeps order and reuses the cache', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'W-1', 3);
    const cache = createIssueCache();
    const res = await fetchIssues(j, ['W-1', 'W-2', 'W-1', 'W-3'], cache);
    expect(j.getIssueCalls).toBe(3);
    expect(res.map((r) => (r.kind === 'ok' ? r.issue.key : r.kind))).toEqual(['W-1', 'W-2', 'W-1', 'W-3']);
    await fetchIssues(j, ['W-3', 'W-1'], cache);
    expect(j.getIssueCalls).toBe(3); // fully cached: no new network call
  });

  it('extractor second call with a shared cache makes no network call', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'W-1', 12);
    const o = { maxDepth: 2, maxNodes: 100, snapshotId: 't', projectId: 'W', now: NOW, ttlHours: 1 };
    const cache = createIssueCache();
    const first = await extractGraph(j, 'W-1', o, cache);
    expect(j.getIssueCalls).toBe(13);
    j.resetCounters();
    const second = await extractGraph(j, 'W-1', o, cache);
    expect(j.getIssueCalls).toBe(0); // every key served from the run cache
    expect(second).toEqual(first);
  });

  it('slip second call with a shared cache makes no network call', async () => {
    const j = new InstrumentedJira();
    fanout(j, 'S-1', 12, '2027-06-01');
    const cache = createIssueCache();
    const first = await slipFromJira(j, ctx, { issueKey: 'S-1', days: 2 }, cache);
    expect(j.getIssueCalls).toBe(13);
    j.resetCounters();
    const second = await slipFromJira(j, ctx, { issueKey: 'S-1', days: 2 }, cache);
    expect(j.getIssueCalls).toBe(0); // every key served from the run cache
    expect(second).toEqual(first);
  });
});
