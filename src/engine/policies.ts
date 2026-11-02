import type { PolicyRule } from '../../packages/contracts/src/index';

/** Default Decision Firewall rules, enforced server-side inside ANTICIPATE only (not a Jira workflow validator). */
export const DEFAULT_POLICIES: PolicyRule[] = [
  { ruleId: 'P1', type: 'NO_REMOVAL_WITH_ACTIVE_DEPENDENTS', severity: 'BLOCKER', description: 'A component cannot be removed while known consumers still depend on it.' },
  { ruleId: 'P2', type: 'NO_UNKNOWN_IMPACTS_ON_REMOVAL', severity: 'HIGH', description: 'Removal requires every dependency to be confirmed or explicitly resolved.' },
  { ruleId: 'P3', type: 'REQUIRE_VERIFIED_TEST_FOR_IMPACTED', severity: 'MEDIUM', description: 'Each impacted item must have a verifying test.' }
];
