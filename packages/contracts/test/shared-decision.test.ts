import { OPERATIONS, SharedDecision, SharedDecisionReasonCode, SHARED_DECISION_OPERATIONS } from '../src/index';

describe('shared decision workspace contracts (additive)', () => {
  it('registers the ops in OPERATIONS', () => {
    for (const k of Object.keys(SHARED_DECISION_OPERATIONS)) expect(k in OPERATIONS).toBe(true);
  });
  it('reason codes are a closed enum and reject/revoke need an explicit reason', () => {
    expect(SharedDecisionReasonCode.safeParse('SEPARATION_OF_DUTIES').success).toBe(false);
    expect(OPERATIONS.rejectSharedDecision.input.safeParse({ id: 'dec-1', reason: '  ' }).success).toBe(false);
    expect(OPERATIONS.revokeSharedDecision.input.safeParse({ id: 'dec-1' }).success).toBe(false);
    expect(OPERATIONS.getSharedDecision.input.safeParse({ id: 'dec-1:../x' }).success).toBe(false);
    expect(OPERATIONS.listDecisionAudit.input.parse({ id: 'dec-1' })).toEqual({ id: 'dec-1', cursor: null, limit: 50 });
  });
  it('a decision view validates', () => {
    const no = { allowed: false, reason: 'MISSING_PERMISSION' as const };
    expect(SharedDecision.safeParse({ id: 'dec-1', projectKey: 'JDG', issueKey: 'JDG-1', planId: 'p1', version: 'h', planHash: 'h', proposer: 'a',
      createdAt: '2026-11-03T10:00:00.000Z', expiresAt: '2026-11-10T10:00:00.000Z', requiredApprovals: 1, state: 'IN_REVIEW', approvals: [],
      evidenceChanged: false, waitingFor: null, closed: null, capabilities: { canApprove: no, canReject: no, canRevoke: no, canExecute: no } }).success).toBe(true);
  });
});
