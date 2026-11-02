/**
 * DEMO_FIXTURE data — fictional, deterministic. Used for contract tests, simulation ground truth and
 * EXPERIENCE local development. Never returned by the LIVE backend.
 */
import type { GraphSnapshot, PolicyRule, ScenarioDefinition, EvidenceReference } from './index';

const T = '2026-11-02T09:00:00.000Z';
const ref = (sourceId: string, extractor = 'fixture'): EvidenceReference => ({ sourceSystem: 'FIXTURE', sourceId, url: null, extractor, observedAt: T });

export const FIXTURE_SNAPSHOT: GraphSnapshot = {
  snapshotId: 'snap-fixture-0001', projectId: 'fixture-10001', createdAt: T, expiresAt: '2026-11-03T09:00:00.000Z', mode: 'DEMO_FIXTURE',
  truncated: false, limits: { maxDepth: 6, maxNodes: 500 },
  nodes: [
    { id: 'svc-auth-v1', kind: 'SERVICE', label: 'Legacy Auth API v1', status: 'CONFIRMED', attributes: {}, references: [ref('component:auth-v1', 'jira.component')] },
    { id: 'svc-auth-v2', kind: 'SERVICE', label: 'Auth API v2', status: 'CONFIRMED', attributes: {}, references: [ref('component:auth-v2', 'jira.component')] },
    { id: 'svc-checkout', kind: 'SERVICE', label: 'Checkout service', status: 'CONFIRMED', attributes: {}, references: [ref('component:checkout', 'jira.component')] },
    { id: 'svc-mobile', kind: 'SERVICE', label: 'Mobile app backend', status: 'CONFIRMED', attributes: {}, references: [ref('component:mobile', 'jira.component')] },
    { id: 'svc-reporting', kind: 'SERVICE', label: 'Reporting service', status: 'CONFIRMED', attributes: {}, references: [ref('component:reporting', 'jira.component')] },
    { id: 'svc-batch-export', kind: 'SERVICE', label: 'Batch export job', status: 'UNKNOWN', attributes: {}, references: [] },
    { id: 'svc-partner-webhooks', kind: 'SERVICE', label: 'Partner webhooks', status: 'CONFIRMED', attributes: {}, references: [ref('component:webhooks', 'jira.component')] },
    { id: 'test-checkout-auth', kind: 'TEST', label: 'Checkout auth contract test', status: 'CONFIRMED', attributes: {}, references: [ref('FIX-201', 'jira.issue')] },
    { id: 'doc-auth-v1', kind: 'DOCUMENT', label: 'Auth v1 deprecation notice', status: 'CONFIRMED', attributes: {}, references: [ref('page-77', 'confluence.page')] },
    { id: 'issue-PAY-412', kind: 'ISSUE', label: 'PAY-412 Remove legacy auth API v1', status: 'CONFIRMED', attributes: {}, references: [ref('PAY-412', 'jira.issue')] }
  ],
  edges: [
    { id: 'e1', from: 'svc-checkout', to: 'svc-auth-v1', kind: 'USES', status: 'CONFIRMED', references: [ref('FIX-101', 'jira.issuelink')], accessLimited: false },
    { id: 'e2', from: 'svc-mobile', to: 'svc-auth-v1', kind: 'USES', status: 'CONFIRMED', references: [ref('FIX-102', 'jira.issuelink')], accessLimited: false },
    { id: 'e3', from: 'svc-reporting', to: 'svc-auth-v1', kind: 'USES', status: 'INFERRED', references: [ref('FIX-103', 'jira.text-mention')], accessLimited: false },
    { id: 'e4', from: 'svc-batch-export', to: 'svc-auth-v1', kind: 'USES', status: 'UNKNOWN', references: [], accessLimited: true },
    { id: 'e5', from: 'svc-partner-webhooks', to: 'svc-checkout', kind: 'DEPENDS_ON', status: 'CONFIRMED', references: [ref('FIX-104', 'jira.issuelink')], accessLimited: false },
    { id: 'e6', from: 'svc-checkout', to: 'test-checkout-auth', kind: 'VERIFIED_BY', status: 'CONFIRMED', references: [ref('FIX-201', 'jira.issuelink')], accessLimited: false },
    { id: 'e7', from: 'svc-auth-v1', to: 'doc-auth-v1', kind: 'DOCUMENTED_IN', status: 'CONFIRMED', references: [ref('page-77', 'confluence.link')], accessLimited: false },
    { id: 'e8', from: 'issue-PAY-412', to: 'svc-auth-v1', kind: 'AFFECTS', status: 'CONFIRMED', references: [ref('PAY-412', 'jira.component')], accessLimited: false }
  ]
};

export const FIXTURE_POLICIES: PolicyRule[] = [
  { ruleId: 'P1', type: 'NO_REMOVAL_WITH_ACTIVE_DEPENDENTS', severity: 'BLOCKER', description: 'A component cannot be removed while known consumers still use it.' },
  { ruleId: 'P2', type: 'NO_UNKNOWN_IMPACTS_ON_REMOVAL', severity: 'HIGH', description: 'Removal requires every dependency to be confirmed or explicitly resolved.' },
  { ruleId: 'P3', type: 'REQUIRE_VERIFIED_TEST_FOR_IMPACTED', severity: 'MEDIUM', description: 'Each impacted service must have a verifying test.' }
];

export const FIXTURE_SCENARIOS: ScenarioDefinition[] = [
  { scenarioId: 'A-remove-now', label: 'Remove legacy auth API now', operations: [{ op: 'REMOVE_NODE', nodeId: 'svc-auth-v1' }] },
  { scenarioId: 'B-retain-temporarily', label: 'Retain API temporarily during transition', operations: [{ op: 'DEPRECATE_NODE', nodeId: 'svc-auth-v1', retainUntil: '2027-03-31T00:00:00.000Z' }] },
  { scenarioId: 'C-migrate-then-retire', label: 'Migrate all consumers first, then retire', operations: [
    { op: 'MIGRATE_DEPENDENTS', fromNodeId: 'svc-auth-v1', toNodeId: 'svc-auth-v2', edgeKinds: ['USES'] },
    { op: 'REMOVE_NODE', nodeId: 'svc-auth-v1' }
  ] }
];
