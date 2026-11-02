/**
 * @anticipate/contracts — authoritative shared schema between CORE (backend) and EXPERIENCE (frontend).
 * Owner: CORE. Changes follow semver of CONTRACT_VERSION; breaking changes are announced in
 * docs/coordination/STATUS_CORE.md before merge.
 */
import { z } from 'zod';

export const CONTRACT_VERSION = '0.2.0';

// ---------- primitives ----------
export const Id = z.string().min(1).max(200);
export const IsoDate = z.string().datetime({ offset: true });
export const Url = z.string().url().max(2000);

export const EvidenceStatus = z.enum(['CONFIRMED', 'INFERRED', 'UNKNOWN']);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const DataMode = z.enum(['LIVE', 'DEMO_FIXTURE']);
export type DataMode = z.infer<typeof DataMode>;

export const ErrorCode = z.enum([
  'PERMISSION_DENIED', 'NOT_FOUND', 'VALIDATION', 'SNAPSHOT_EXPIRED', 'STALE_APPROVAL', 'CONFLICT',
  'RATE_LIMITED', 'UPSTREAM_UNAVAILABLE', 'UNSUPPORTED', 'TIMEOUT', 'BUDGET_EXCEEDED', 'INTERNAL'
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string().max(1000),
  requestId: Id,
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
});
export type ApiError = z.infer<typeof ApiError>;

export const PageInfo = z.object({ nextCursor: z.string().nullable(), totalKnown: z.number().int().nonnegative().nullable() });
export type PageInfo = z.infer<typeof PageInfo>;

/** Envelope for every resolver response. */
export const ResponseMeta = z.object({ contractVersion: z.string(), requestId: Id, mode: DataMode, generatedAt: IsoDate });
export const ok = <T extends z.ZodTypeAny>(data: T) => z.object({ ok: z.literal(true), meta: ResponseMeta, data });
export const Failure = z.object({ ok: z.literal(false), meta: ResponseMeta, error: ApiError });
export const envelope = <T extends z.ZodTypeAny>(data: T) => z.discriminatedUnion('ok', [ok(data), Failure]);

/** Server-derived; never accepted from the client. Documented for logs/passports. */
export const RequestContext = z.object({ requestId: Id, installationId: Id, accountId: Id.nullable(), siteUrl: Url.nullable() });
export type RequestContext = z.infer<typeof RequestContext>;

// ---------- capabilities ----------
export const CapabilityState = z.enum(['AVAILABLE', 'NOT_CONFIGURED', 'UNSUPPORTED', 'PERMISSION_REQUIRED', 'DISABLED_BY_BUDGET']);
export const CapabilityAvailability = z.object({
  jiraRead: CapabilityState, jiraWrite: CapabilityState, confluenceRead: CapabilityState,
  workflowValidator: CapabilityState, rovoAgent: CapabilityState, rovoMcp: CapabilityState,
  teamworkGraph: CapabilityState, llm: CapabilityState,
  operations: z.array(z.string())
});
export type CapabilityAvailability = z.infer<typeof CapabilityAvailability>;

// ---------- Jira ----------
export const ProjectSummary = z.object({
  id: Id, key: z.string().max(50), name: z.string().max(300), url: Url.nullable(),
  issueCount: z.number().int().nonnegative().nullable(), lastSnapshotAt: IsoDate.nullable(),
  dataAvailability: z.enum(['READY', 'NO_SNAPSHOT', 'INSUFFICIENT_PERMISSION', 'EMPTY'])
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const JiraIssueSummary = z.object({
  id: Id, key: z.string().max(50), summary: z.string().max(1000), status: z.string().max(100),
  issueType: z.string().max(100), url: Url.nullable(), updatedAt: IsoDate, projectId: Id
});
export type JiraIssueSummary = z.infer<typeof JiraIssueSummary>;

// ---------- evidence graph ----------
export const NodeKind = z.enum(['ISSUE', 'PROJECT', 'COMPONENT', 'SERVICE', 'RELEASE', 'TEST', 'DOCUMENT', 'DECISION']);
export const EdgeKind = z.enum(['DEPENDS_ON', 'BLOCKS', 'USES', 'VERIFIED_BY', 'DOCUMENTED_IN', 'AFFECTS']);
export type NodeKind = z.infer<typeof NodeKind>;
export type EdgeKind = z.infer<typeof EdgeKind>;

export const EvidenceReference = z.object({
  sourceSystem: z.enum(['JIRA', 'CONFLUENCE', 'MANUAL', 'FIXTURE']),
  sourceId: Id, url: Url.nullable(),
  extractor: z.string().max(100), // e.g. "jira.issuelink", "jira.component"
  observedAt: IsoDate
});
export type EvidenceReference = z.infer<typeof EvidenceReference>;

export const EvidenceNode = z.object({
  id: Id, kind: NodeKind, label: z.string().max(500), status: EvidenceStatus,
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  references: z.array(EvidenceReference)
});
export type EvidenceNode = z.infer<typeof EvidenceNode>;

/** Directed: `from` --kind--> `to`. Semantics: from DEPENDS_ON to ⇒ a change to `to` may impact `from`. */
export const EvidenceEdge = z.object({
  id: Id, from: Id, to: Id, kind: EdgeKind, status: EvidenceStatus,
  references: z.array(EvidenceReference),
  accessLimited: z.boolean() // true if part of the evidence was unreadable for the requesting user
});
export type EvidenceEdge = z.infer<typeof EvidenceEdge>;

export const GraphSnapshot = z.object({
  snapshotId: Id, projectId: Id, createdAt: IsoDate, expiresAt: IsoDate, mode: DataMode,
  nodes: z.array(EvidenceNode).max(5000), edges: z.array(EvidenceEdge).max(20000),
  truncated: z.boolean(), limits: z.object({ maxDepth: z.number().int(), maxNodes: z.number().int() })
});
export type GraphSnapshot = z.infer<typeof GraphSnapshot>;

// ---------- simulation ----------
export const ChangeOperation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('REMOVE_NODE'), nodeId: Id }),
  z.object({ op: z.literal('DEPRECATE_NODE'), nodeId: Id, retainUntil: IsoDate.nullable() }),
  z.object({ op: z.literal('MIGRATE_DEPENDENTS'), fromNodeId: Id, toNodeId: Id, edgeKinds: z.array(EdgeKind).min(1) })
]);
export type ChangeOperation = z.infer<typeof ChangeOperation>;

export const ProposedChange = z.object({ issueKey: z.string().max(50).nullable(), targetNodeId: Id, description: z.string().max(2000) });
export type ProposedChange = z.infer<typeof ProposedChange>;

export const ScenarioDefinition = z.object({
  scenarioId: Id, label: z.string().max(200), operations: z.array(ChangeOperation).min(1).max(50)
});
export type ScenarioDefinition = z.infer<typeof ScenarioDefinition>;

export const PolicyRule = z.object({
  ruleId: Id, description: z.string().max(500), severity: z.enum(['BLOCKER', 'HIGH', 'MEDIUM', 'LOW']),
  type: z.enum(['NO_REMOVAL_WITH_ACTIVE_DEPENDENTS', 'REQUIRE_VERIFIED_TEST_FOR_IMPACTED', 'NO_UNKNOWN_IMPACTS_ON_REMOVAL'])
});
export type PolicyRule = z.infer<typeof PolicyRule>;

export const SimulationRequest = z.object({
  snapshotId: Id, change: ProposedChange, scenarios: z.array(ScenarioDefinition).min(1).max(5),
  maxDepth: z.number().int().min(1).max(10).default(6)
});
export type SimulationRequest = z.infer<typeof SimulationRequest>;

export const ImpactRecord = z.object({
  nodeId: Id, depth: z.number().int().positive(), direct: z.boolean(),
  pathEdgeIds: z.array(Id), // causal evidence path from changed node to this node
  weakestStatus: EvidenceStatus // weakest evidence on that path
});
export type ImpactRecord = z.infer<typeof ImpactRecord>;

export const PolicyViolation = z.object({
  ruleId: Id, severity: PolicyRule.shape.severity, nodeIds: z.array(Id), explanation: z.string().max(1000), pathEdgeIds: z.array(Id)
});
export type PolicyViolation = z.infer<typeof PolicyViolation>;

export const UncertaintyRecord = z.object({
  nodeId: Id.nullable(), edgeId: Id.nullable(), reason: z.enum(['UNKNOWN_EDGE', 'INFERRED_ONLY', 'ACCESS_LIMITED', 'TRUNCATED', 'MISSING_TEST_EVIDENCE']),
  explanation: z.string().max(1000)
});
export type UncertaintyRecord = z.infer<typeof UncertaintyRecord>;

export const SimulationResult = z.object({
  scenarioId: Id, snapshotId: Id, impacts: z.array(ImpactRecord), violations: z.array(PolicyViolation),
  uncertainties: z.array(UncertaintyRecord),
  summary: z.object({ impacted: z.number().int(), direct: z.number().int(), transitive: z.number().int(), blockers: z.number().int(), unknowns: z.number().int() }),
  verdict: z.enum(['BLOCKED', 'NEEDS_REVIEW', 'PASS']),
  resultHash: z.string() // deterministic hash of the result for reproducibility
});
export type SimulationResult = z.infer<typeof SimulationResult>;

export const ScenarioComparison = z.object({
  snapshotId: Id, results: z.array(SimulationResult),
  diff: z.array(z.object({ scenarioId: Id, onlyImpacted: z.array(Id), onlyViolatedRules: z.array(Id) })),
  recommendedScenarioId: Id.nullable(), recommendationReason: z.string().max(1000)
});
export type ScenarioComparison = z.infer<typeof ScenarioComparison>;

// ---------- plans, approvals, execution ----------
export const ProposedAction = z.object({
  actionId: Id, type: z.enum(['CREATE_ISSUE', 'ADD_ISSUE_LINK', 'ADD_COMMENT', 'ADD_LABEL']),
  targetProjectKey: z.string().max(50), targetIssueKey: z.string().max(50).nullable(),
  payload: z.record(z.string(), z.unknown()), reason: z.string().max(1000),
  evidenceEdgeIds: z.array(Id), requiredPermission: z.string().max(100), verificationRule: z.string().max(500)
});
export type ProposedAction = z.infer<typeof ProposedAction>;

export const PreventionPlan = z.object({
  planId: Id, snapshotId: Id, scenarioId: Id, createdAt: IsoDate, status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'EXPIRED']),
  actions: z.array(ProposedAction).max(50), planHash: z.string()
});
export type PreventionPlan = z.infer<typeof PreventionPlan>;

export const ApprovalRequest = z.object({
  planId: Id, planHash: z.string(), approvedActionIds: z.array(Id).min(1), idempotencyKey: z.string().min(16).max(100)
});
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

export const ExecutionStatus = z.enum(['PENDING', 'CLAIMED', 'SUBMITTED', 'VERIFIED', 'FAILED', 'SKIPPED']);
export const ExecutionRecord = z.object({
  executionId: Id, planId: Id, actionId: Id, status: ExecutionStatus, attempt: z.number().int().nonnegative(),
  idempotencyKey: z.string(), resultRef: z.object({ issueKey: z.string().nullable(), url: Url.nullable() }).nullable(),
  error: ApiError.nullable(), updatedAt: IsoDate
});
export type ExecutionRecord = z.infer<typeof ExecutionRecord>;

export const PreventionPassport = z.object({
  passportId: Id, mode: DataMode, snapshotId: Id, change: ProposedChange, comparison: ScenarioComparison,
  plan: PreventionPlan.nullable(), approvals: z.array(z.object({ accountId: Id.nullable(), at: IsoDate, actionIds: z.array(Id) })),
  executions: z.array(ExecutionRecord), openUnknowns: z.array(UncertaintyRecord),
  timeline: z.array(z.object({ at: IsoDate, event: z.string().max(200) })),
  disclaimer: z.string()
});
export type PreventionPassport = z.infer<typeof PreventionPassport>;

// ---------- operation catalogue ----------
export const OPERATIONS = {
  getCapabilities: { input: z.object({}), output: CapabilityAvailability },
  listProjects: { input: z.object({ cursor: z.string().nullable().default(null) }), output: z.object({ items: z.array(ProjectSummary), page: PageInfo }) },
  getChangeCandidates: { input: z.object({ projectId: Id, cursor: z.string().nullable().default(null) }), output: z.object({ items: z.array(JiraIssueSummary), page: PageInfo }) },
  getGraphSnapshot: { input: z.object({ projectId: Id, rootIssueKey: z.string().max(50), source: z.enum(['JIRA', 'DEMO_FIXTURE']).default('JIRA'), maxDepth: z.number().int().min(1).max(5).default(3) }), output: GraphSnapshot },
  getEvidenceGraph: { input: z.object({ snapshotId: Id }), output: GraphSnapshot },
  simulateChange: { input: SimulationRequest, output: z.array(SimulationResult) },
  compareScenarios: { input: SimulationRequest, output: ScenarioComparison },
  generatePreventionPlan: { input: z.object({ snapshotId: Id, scenarioId: Id }), output: PreventionPlan },
  approvePlan: { input: ApprovalRequest, output: PreventionPlan },
  executeApprovedPlan: { input: z.object({ planId: Id, idempotencyKey: z.string().min(16).max(100) }), output: z.array(ExecutionRecord) },
  getExecutionStatus: { input: z.object({ planId: Id }), output: z.array(ExecutionRecord) },
  getPreventionPassport: { input: z.object({ planId: Id }), output: PreventionPassport },
  getPolicies: { input: z.object({}), output: z.array(PolicyRule) }
} as const;
export type OperationName = keyof typeof OPERATIONS;
