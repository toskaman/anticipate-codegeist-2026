import { makeHandler } from '../src/core/handler';
import { checkThrottle, createStoreThrottle, DEFAULT_THROTTLE, throttleKey } from '../src/core/throttle';
import { memoryStore } from './fakes';

function setup(limit = 3, windowMs = 60_000, start = '2026-11-02T09:00:00.000Z') {
  const store = memoryStore();
  let now = Date.parse(start);
  const throttle = createStoreThrottle(store, { limit, windowMs, now: () => now });
  const advance = (ms: number) => { now += ms; };
  return { store, throttle, advance };
}

const userA = { installationId: 'install-1', accountId: 'acc-A' };
const userB = { installationId: 'install-1', accountId: 'acc-B' };

describe('throttle key', () => {
  it('isolates users and installations', () => {
    expect(throttleKey('i1', 'a', 'getPolicies')).not.toBe(throttleKey('i1', 'b', 'getPolicies'));
    expect(throttleKey('i1', 'a', 'getPolicies')).not.toBe(throttleKey('i2', 'a', 'getPolicies'));
    expect(throttleKey('i1', null, 'getPolicies')).toBe(throttleKey('i1', null, 'getPolicies'));
  });
  it('ships documented production defaults', () => {
    expect(DEFAULT_THROTTLE.limit).toBeGreaterThan(0);
    expect(DEFAULT_THROTTLE.windowMs).toBeGreaterThan(0);
  });
});

describe('store-backed sliding window', () => {
  it('allows a burst then rejects, with retryAfterMs backoff hint', async () => {
    const s = setup(3, 60_000);
    expect((await checkThrottle(s.store, userA, 'getPolicies', { limit: 3, windowMs: 60_000, now: () => Date.parse('2026-11-02T09:00:00.000Z') })).allowed).toBe(true);
    const t = createStoreThrottle(s.store, { limit: 3, windowMs: 60_000, now: () => Date.parse('2026-11-02T09:00:00.000Z') });
    // 1 consumed above; 2 more allowed, 4th rejected
    expect((await t(userA, 'getPolicies')).allowed).toBe(true);
    expect((await t(userA, 'getPolicies')).allowed).toBe(true);
    const rejected = await t(userA, 'getPolicies');
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
    expect(rejected.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('resets after the window slides past', async () => {
    const s = setup(2, 10_000);
    expect((await s.throttle(userA, 'getPolicies')).allowed).toBe(true);
    expect((await s.throttle(userA, 'getPolicies')).allowed).toBe(true);
    expect((await s.throttle(userA, 'getPolicies')).allowed).toBe(false);
    s.advance(10_001);
    const again = await s.throttle(userA, 'getPolicies');
    expect(again.allowed).toBe(true);
    expect(again.remaining).toBe(1);
  });

  it('isolates budgets per user (and per installation)', async () => {
    const s = setup(1, 60_000);
    expect((await s.throttle(userA, 'getPolicies')).allowed).toBe(true);
    expect((await s.throttle(userA, 'getPolicies')).allowed).toBe(false);
    // Another user on the same installation is unaffected
    expect((await s.throttle(userB, 'getPolicies')).allowed).toBe(true);
    // Same user on another installation is unaffected
    expect((await s.throttle({ ...userA, installationId: 'install-2' }, 'getPolicies')).allowed).toBe(true);
  });

  it('persists across throttle instances sharing the same store (no local memory)', async () => {
    const s = setup(1, 60_000);
    const first = createStoreThrottle(s.store, { limit: 1, windowMs: 60_000, now: () => Date.parse('2026-11-02T09:00:00.000Z') });
    const second = createStoreThrottle(s.store, { limit: 1, windowMs: 60_000, now: () => Date.parse('2026-11-02T09:00:00.000Z') });
    expect((await first(userA, 'getPolicies')).allowed).toBe(true);
    // A fresh instance (fresh serverless isolate) sees the same budget: state is in the store.
    expect((await second(userA, 'getPolicies')).allowed).toBe(false);
  });
});

describe('handler wiring', () => {
  it('rejects with retryable RATE_LIMITED before execution when the budget is exhausted', async () => {
    const s = setup(1, 60_000);
    let ran = 0;
    const h = makeHandler('getPolicies', () => 'LIVE', () => 'req-1', () => new Date('2026-11-02T09:00:00Z'),
      async () => { ran++; return []; }, { throttle: s.throttle });
    const okRes = await h({ payload: {}, context: { accountId: 'acc-A', installContext: 'install-1' } });
    expect(okRes).toMatchObject({ ok: true });
    expect(ran).toBe(1);
    const limited = await h({ payload: {}, context: { accountId: 'acc-A', installContext: 'install-1' } });
    expect(limited).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED', retryable: true, requestId: 'req-1' } });
    const err = (limited as unknown as { ok: false; error: { details: { retryAfterMs: number } } }).error;
    expect(err.details.retryAfterMs).toBeGreaterThan(0);
    expect(ran).toBe(1); // use-case never ran
  });

  it('validates input before throttling (bad payloads never consume budget)', async () => {
    const s = setup(1, 60_000);
    let ran = 0;
    const h = makeHandler('getGraphSnapshot', () => 'LIVE', () => 'req-1', () => new Date('2026-11-02T09:00:00Z'),
      async () => { ran++; return {}; }, { throttle: s.throttle });
    const bad = await h({ payload: { projectId: '' }, context: { accountId: 'acc-A', installContext: 'install-1' } });
    expect(bad).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(ran).toBe(0);
    // Budget untouched: a valid call still passes.
    const good = await h({ payload: { projectId: 'PAY', rootIssueKey: 'PAY-1' }, context: { accountId: 'acc-A', installContext: 'install-1' } });
    expect((good as { ok: boolean }).ok).toBe(false); // output contract violation ({}), but throttle passed
    expect(ran).toBe(1);
  });

  it('keeps existing behaviour when no throttle is configured', async () => {
    const h = makeHandler('getPolicies', () => 'LIVE', () => 'req-1', () => new Date('2026-11-02T09:00:00Z'), async () => []);
    expect(await h({})).toMatchObject({ ok: true, data: [] });
  });
});
