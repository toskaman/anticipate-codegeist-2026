import { describe, it, expect, vi } from 'vitest';

const calls: unknown[][] = [];
vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => {
  const builder = () => {
    const b = {
      where: (...a: unknown[]) => { calls.push(['where', ...a]); return b; },
      limit: (n: number) => { calls.push(['limit', n]); return b; },
      cursor: (c: string) => { calls.push(['cursor', c]); return b; },
      getMany: async () => ({ results: [{ key: 'radar:idx:1:plan-a', value: { planId: 'plan-a' } }], nextCursor: 'next' })
    };
    return b;
  };
  return { kvs: { query: () => builder() }, WhereConditions: { beginsWith: (v: string) => ({ condition: 'BEGINS_WITH', values: [v] }) } };
});

import { forgeStore, retentionFor } from '../src/forge-adapters';

describe('forgeStore.listByPrefix (@forge/kvs 2.1.1 query API)', () => {
  it('uses kvs.query().where(key, beginsWith).limit(<=100).cursor().getMany()', async () => {
    const r = await forgeStore.listByPrefix!('radar:idx:1:', 'c1', 500);
    expect(calls).toEqual([['where', 'key', { condition: 'BEGINS_WITH', values: ['radar:idx:1:'] }], ['limit', 100], ['cursor', 'c1']]);
    expect(r).toEqual({ items: [{ key: 'radar:idx:1:plan-a', value: { planId: 'plan-a' } }], nextCursor: 'next' });
  });
  it('radar dedupe marks expire after 7 days; index/attention follow plan retention', () => {
    expect(retentionFor('radar:evt:1:avi:jira:deleted:issue')).toEqual({ value: 7, unit: 'DAYS' });
    expect(retentionFor('radar:idx:1:plan-a')).toEqual({ value: 90, unit: 'DAYS' });
    expect(retentionFor('radar:att:plan-a')).toEqual({ value: 90, unit: 'DAYS' });
  });
});
