/**
 * @anticipate/contracts — authoritative shared schema between CORE (backend) and EXPERIENCE (frontend).
 * Owner: CORE. Changes follow semver of CONTRACT_VERSION; breaking changes are announced in
 * docs/coordination/STATUS_CORE.md before merge.
 */
import { z } from 'zod';

/** Wire version stays 0.2.0: the EXPERIENCE client pins it exactly. 0.3 additions are additive and listed in CONTRACT_FEATURES. */
export const CONTRACT_VERSION = '0.2.0';
export const CONTRACT_FEATURES = ['continuous-decision-safety', 'sample-project', 'evidence-coverage', 'service-decommission', 'workflow-validator', 'plan-invalidation', 'portfolio-simulation', 'shared-decision-workspace'] as const;

// ---------- primitives ----------
export const Id = z.string().min(1).max(200);
export const IsoDate = z.string().datetime({ offset: true });
export const Url = z.string().url().max(2000);

export const EvidenceStatus = z.enum(['CONFIRMED', 'INFERRED', 'UNKNOWN']);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const DataMode = z.enum(['LIVE', 'DEMO_FIXTURE']);
export type DataMode = z.infer<typeof DataMode>;

export const ErrorCode = z.enum([
  'EVIDENCE_CHANGED', 'PERMISSION_DENIED', 'NOT_FOUND', 'VALIDATION', 'SNAPSHOT_EXPIRED', 'STALE_APPROVAL', 'CONFLICT',
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
  operations: z.array(z.string()),
  /** Portfolio Impact Simulator availability (optional, additive; absent on older backends). Hard bounds: PORTFOLIO_LIMITS. */
  portfolioSimulation: CapabilityState.optional()
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
  sourceSystem: z.enum(['JIRA', 'CONFLUENCE', 'TEAMWORK_GRAPH', 'MANUAL', 'FIXTURE']),
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
  truncated: z.boolean(), limits: z.object({ maxDepth: z.number().int(), maxNodes: z.number().int() }),
  /** Per-source evidence coverage (optional, additive). Absent = Jira only. */
  coverage: z.array(z.object({ source: z.enum(['JIRA', 'TEAMWORK_GRAPH']), state: z.enum(['FULL', 'PARTIAL', 'UNAVAILABLE', 'NOT_CONFIGURED']), detail: z.string().max(300) })).max(5).optional()
});
export type GraphSnapshot = z.infer<typeof GraphSnapshot>;

// ---------- simulation ----------
export const ChangeOperation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('REMOVE_NODE'), nodeId: Id }),
  z.object({ op: z.literal('DEPRECATE_NODE'), nodeId: Id, retainUntil: IsoDate.nullable() }),
  z.object({ op: z.literal('UPGRADE_NODE'), nodeId: Id, breaking: z.boolean() }),
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
  type: z.enum(['NO_REMOVAL_WITH_ACTIVE_DEPENDENTS', 'REQUIRE_VERIFIED_TEST_FOR_IMPACTED', 'NO_UNKNOWN_IMPACTS_ON_REMOVAL', 'NO_DECOMMISSION_WITH_OPEN_WORK'])
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
  planId: Id, snapshotId: Id, scenarioId: Id, createdAt: IsoDate, status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'PARTIAL', 'FAILED', 'EXPIRED', 'EVIDENCE_CHANGED', 'INVALIDATED']),
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
  disclaimer: z.string(),
  /** Retention state of the evidence behind this record. ARCHIVED = full snapshot gone, minimized provenance kept. */
  evidence: z.object({ state: z.enum(['LIVE', 'EXPIRED_SNAPSHOT', 'ARCHIVED']), capturedAt: IsoDate, expiresAt: IsoDate,
    nodeCount: z.number().int().nonnegative(), edgeCount: z.number().int().nonnegative(), causalEdgeCount: z.number().int().nonnegative(), snapshotDigest: z.string().max(64) }).optional(),
  /** What the Jira workflow validator would decide right now for the changed issue (only if that issue is gated). */
  gate: z.object({ status: z.enum(['OPEN', 'CLOSED', 'NOT_GATED']), reason: z.string().max(500) }).optional()
});
export type PreventionPassport = z.infer<typeof PreventionPassport>;

// ---------- continuous decision safety ----------
/** Structural difference between the evidence a plan was built on and the live Jira evidence now. */
export const EvidenceDrift = z.object({
  planId: Id, snapshotId: Id, checkedAt: IsoDate, fresh: z.boolean(),
  addedEdges: z.array(z.object({ from: Id, to: Id, kind: EdgeKind, status: EvidenceStatus })).max(500),
  removedEdges: z.array(z.object({ from: Id, to: Id, kind: EdgeKind, status: EvidenceStatus })).max(500),
  becameUnknown: z.array(Id).max(500),
  ignoredPlanArtifacts: z.array(z.string()).max(100), // issues created by this plan's own verified actions
  reason: z.string().max(1000)
});
export type EvidenceDrift = z.infer<typeof EvidenceDrift>;

// ---------- judge sample project ----------
export const SampleItem = z.object({ role: z.string(), summary: z.string(), issueKey: z.string().nullable(), status: z.enum(['TO_CREATE', 'EXISTS', 'CREATED', 'FAILED']),
  /** Planned date for a new sample, actual Jira date for an existing one; omitted by older backends. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() });
export const SampleLink = z.object({ from: z.string(), relation: z.literal('blocks'), to: z.string(), status: z.enum(['TO_CREATE', 'EXISTS', 'CREATED', 'FAILED']) });
export const SampleProjectPlan = z.object({
  projectKey: z.string(), issueType: z.string().nullable(), canCreate: z.boolean(), missingPermissions: z.array(z.string()),
  items: z.array(SampleItem).max(10), links: z.array(SampleLink).max(10),
  rootIssueKey: z.string().nullable(), replacementIssueKey: z.string().nullable(), note: z.string()
});
export type SampleProjectPlan = z.infer<typeof SampleProjectPlan>;

// ---------- operation catalogue ----------
/** Admin-controlled behaviour of the Jira workflow validator when ANTICIPATE cannot verify a decision (outage). */
export const SlipSimulation = z.object({
  issueKey: z.string().max(50), days: z.number().int(), assumptions: z.array(z.string().max(300)).max(10),
  moved: z.array(z.object({ key: z.string().max(50), oldDue: z.string().max(10), newDue: z.string().max(10), slipDays: z.number().int(), path: z.array(z.string().max(50)).max(60) })).max(60),
  absorbed: z.array(z.object({ key: z.string().max(50), due: z.string().max(10), path: z.array(z.string().max(50)).max(60) })).max(60),
  unknown: z.array(z.object({ key: z.string().max(50), reason: z.string().max(200), path: z.array(z.string().max(50)).max(60) })).max(60),
  releases: z.array(z.object({ name: z.string().max(255), releaseDate: z.string().max(10), lateByDays: z.number().int(), issues: z.array(z.string().max(50)).max(60) })).max(30),
  unreadable: z.array(z.string().max(50)).max(60), truncated: z.boolean()
});
export type SlipSimulation = z.infer<typeof SlipSimulation>;
// ---------- portfolio impact simulator (multi-change, additive) ----------
/** Hard bounds of the portfolio simulator. Mirrored (and checked by a test) in simulation-core/src/portfolio.ts. */
export const PORTFOLIO_LIMITS = { maxChanges: 10, maxOperationsPerChange: 20, maxNodes: 2000, maxEdges: 10000, maxDepth: 10 } as const;

/** One named proposed change of a portfolio; operations reuse the scenario operation types. */
export const PortfolioChange = z.object({
  id: Id, label: z.string().max(200), operations: z.array(ChangeOperation).min(1).max(PORTFOLIO_LIMITS.maxOperationsPerChange)
});
export type PortfolioChange = z.infer<typeof PortfolioChange>;

export const PortfolioInput = z.object({
  snapshotId: Id,
  changes: z.array(PortfolioChange).min(1).max(PORTFOLIO_LIMITS.maxChanges)
    .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, { message: 'change ids must be unique' }),
  maxDepth: z.number().int().min(1).max(PORTFOLIO_LIMITS.maxDepth).default(6),
  /** Optional sequence to check against the derived ordering constraints. */
  proposedOrder: z.array(Id).max(PORTFOLIO_LIMITS.maxChanges).nullable().default(null)
});
export type PortfolioInput = z.infer<typeof PortfolioInput>;

const NodeChanges = z.object({ nodeId: Id, changeIds: z.array(Id) });
export const PortfolioConflict = z.object({
  conflictId: Id,
  kind: z.enum(['MIGRATE_ONTO_RETIRED', 'COMPETING_MIGRATION', 'SAME_TARGET', 'DEPENDENCY_CHAIN', 'EMERGENT_IMPACT']),
  changeIds: z.array(Id).min(1), nodeIds: z.array(Id), reason: z.string().max(4000), evidenceGapEdgeIds: z.array(Id)
});
export type PortfolioConflict = z.infer<typeof PortfolioConflict>;

export const PortfolioOrderingConstraint = z.object({
  before: Id, after: Id, kind: z.enum(['MIGRATE_BEFORE_RETIRE', 'DEPENDENCY_FIRST', 'RETIRE_CONSUMER_FIRST']),
  nodeIds: z.array(Id), reason: z.string().max(2000)
});
export type PortfolioOrderingConstraint = z.infer<typeof PortfolioOrderingConstraint>;

export const PortfolioStep = z.object({
  changeId: Id, verdict: SimulationResult.shape.verdict, impacted: z.number().int().nonnegative(),
  newlyImpacted: z.array(Id), noLongerImpacted: z.array(Id)
});
export type PortfolioStep = z.infer<typeof PortfolioStep>;

export const PortfolioEvidenceGap = z.object({
  edgeId: Id, from: Id, to: Id, kind: z.enum(['UNKNOWN_ON_IMPACT_PATH', 'UNKNOWN_NOT_MIGRATED']), nodeIds: z.array(Id)
});
export type PortfolioEvidenceGap = z.infer<typeof PortfolioEvidenceGap>;

export const PortfolioVerdictExplanation = z.object({
  changeId: Id, standaloneVerdict: SimulationResult.shape.verdict, portfolioVerdict: SimulationResult.shape.verdict,
  changedByOthers: z.boolean(), gainedNodeIds: z.array(Id), maskedNodeIds: z.array(Id), marginalNodeIds: z.array(Id),
  causes: z.array(z.object({ changeId: Id, gainedNodeIds: z.array(Id), maskedNodeIds: z.array(Id), verdictEffect: z.boolean() })),
  jointlyCausedNodeIds: z.array(Id), explanation: z.string().max(4000)
});
export type PortfolioVerdictExplanation = z.infer<typeof PortfolioVerdictExplanation>;

export const PortfolioResult = z.object({
  snapshotId: Id, maxDepth: z.number().int(), changeIds: z.array(Id),
  individual: z.array(z.object({ changeId: Id, label: z.string().max(200), targetNodeIds: z.array(Id), result: SimulationResult })),
  combined: z.object({ order: z.array(Id), result: SimulationResult }),
  sharedImpacts: z.array(NodeChanges), emergentImpacts: z.array(NodeChanges), maskedImpacts: z.array(NodeChanges),
  conflicts: z.array(PortfolioConflict),
  ordering: z.object({
    constraints: z.array(PortfolioOrderingConstraint), cycles: z.array(z.array(Id)), order: z.array(Id).nullable(), steps: z.array(PortfolioStep),
    proposed: z.object({ order: z.array(Id), violatedConstraints: z.array(PortfolioOrderingConstraint), sameAsRecommended: z.boolean(), steps: z.array(PortfolioStep) }).nullable()
  }),
  evidenceGaps: z.array(z.object({ changeId: Id, gaps: z.array(PortfolioEvidenceGap) })),
  verdictExplanations: z.array(PortfolioVerdictExplanation),
  disclaimer: z.string(), resultHash: z.string()
});
export type PortfolioResult = z.infer<typeof PortfolioResult>;

/** Input of getGraphSnapshot (shared with simulatePortfolio, which builds the same permission-filtered snapshot). */
export const GraphSnapshotRequest = z.object({ projectId: Id, rootIssueKey: z.string().max(50), source: z.enum(['JIRA', 'DEMO_FIXTURE']).default('JIRA'), maxDepth: z.number().int().min(1).max(5).default(3) });
export type GraphSnapshotRequest = z.infer<typeof GraphSnapshotRequest>;

/**
 * simulatePortfolio input: the snapshot inputs of getGraphSnapshot (graph depth renamed snapshotMaxDepth) plus the portfolio.
 * Optional snapshotId reuses a snapshot the caller already owns (must have been built for the same rootIssueKey) instead of re-reading Jira.
 */
export const SimulatePortfolioRequest = z.object({
  projectId: GraphSnapshotRequest.shape.projectId, rootIssueKey: GraphSnapshotRequest.shape.rootIssueKey, source: GraphSnapshotRequest.shape.source,
  snapshotMaxDepth: GraphSnapshotRequest.shape.maxDepth, snapshotId: Id.nullable().default(null),
  changes: PortfolioInput.shape.changes, maxDepth: PortfolioInput.shape.maxDepth, proposedOrder: PortfolioInput.shape.proposedOrder
});
export type SimulatePortfolioRequest = z.infer<typeof SimulatePortfolioRequest>;

/** simulatePortfolio output: the pure PortfolioResult plus metadata of the snapshot it ran on. */
export const SimulatePortfolioResult = PortfolioResult.extend({
  snapshot: z.object({
    snapshotId: Id, projectId: Id, rootIssueKey: z.string().max(50), mode: DataMode, createdAt: IsoDate, expiresAt: IsoDate,
    truncated: z.boolean(), nodeCount: z.number().int().nonnegative(), edgeCount: z.number().int().nonnegative(),
    reused: z.boolean(), coverage: GraphSnapshot.shape.coverage
  })
});
export type SimulatePortfolioResult = z.infer<typeof SimulatePortfolioResult>;

export const ValidatorPolicy = z.object({
  onOutage: z.enum(['ALLOW', 'BLOCK']), updatedBy: Id.nullable(), updatedAt: IsoDate.nullable(), canEdit: z.boolean()
});
export type ValidatorPolicy = z.infer<typeof ValidatorPolicy>;

// ---------- shared decision workspace (additive; behind capability flag sharedDecisions, off by default) ----------
// BEGIN shared decision workspace — answers contract request #131 (issue #135). Every op below fails with
// UNSUPPORTED (details.reason = 'FEATURE_DISABLED') until a Jira site admin turns the flag on via setFeatureFlag.
export const SharedDecisionId = z.string().regex(/^dec-[A-Za-z0-9_-]{1,64}$/);
export const SharedDecisionReason = z.string().trim().min(3).max(500);
export const SharedDecisionState = z.enum(['IN_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED']);
export type SharedDecisionState = z.infer<typeof SharedDecisionState>;
/** Closed set of reasons why an actor cannot do something (null = allowed). AWAITING_APPROVAL: execution before all approvals. */
export const SharedDecisionReasonCode = z.enum(['NOT_IN_ROLE', 'PROPOSER', 'EXPIRED', 'EVIDENCE_CHANGED', 'REVOKED', 'REJECTED', 'ALREADY_APPROVED', 'MISSING_PERMISSION', 'AWAITING_APPROVAL']);
export type SharedDecisionReasonCode = z.infer<typeof SharedDecisionReasonCode>;
export const ActorCapability = z.object({ allowed: z.boolean(), reason: SharedDecisionReasonCode.nullable() });
export type ActorCapability = z.infer<typeof ActorCapability>;
export const SharedDecisionApproval = z.object({ by: Id, at: IsoDate, planHash: z.string().max(200) });
export const SharedDecision = z.object({
  id: SharedDecisionId, projectKey: z.string().max(50), issueKey: z.string().max(50), planId: Id,
  /** The decision is bound to exactly one plan version; version === planHash. */
  version: z.string().max(200), planHash: z.string().max(200),
  proposer: Id, createdAt: IsoDate, expiresAt: IsoDate, requiredApprovals: z.number().int().min(1).max(3),
  state: SharedDecisionState,
  /** Approvals bound to planHash; approvals for another hash are never counted. */
  approvals: z.array(SharedDecisionApproval).max(3),
  /** True when the current plan hash differs from the shared one (or the plan is gone / invalidated). */
  evidenceChanged: z.boolean(),
  waitingFor: z.string().max(300).nullable(),
  /** Terminal marker (REJECTED / REVOKED / EXPIRED) recorded first-writer-wins; null while open. */
  closed: z.object({ state: z.enum(['REJECTED', 'REVOKED', 'EXPIRED']), at: IsoDate, by: Id, reason: z.string().max(500) }).nullable(),
  capabilities: z.object({ canApprove: ActorCapability, canReject: ActorCapability, canRevoke: ActorCapability, canExecute: ActorCapability })
});
export type SharedDecision = z.infer<typeof SharedDecision>;
export const SharedDecisionAuditEvent = z.object({
  /** Stable id: `${decisionId}:${seq}`. */
  id: z.string().max(100), decisionId: SharedDecisionId, seq: z.number().int().positive(), at: IsoDate, by: Id,
  event: z.enum(['SHARED', 'APPROVED', 'READY', 'REJECTED', 'REVOKED', 'EXPIRED']), detail: z.string().max(1000).nullable()
});
export type SharedDecisionAuditEvent = z.infer<typeof SharedDecisionAuditEvent>;
export const SHARED_DECISION_AUDIT_PAGE_MAX = 100;
export const FeatureFlagName = z.enum(['sharedDecisions']);
export const FeatureFlag = z.object({ flag: FeatureFlagName, enabled: z.boolean(), updatedBy: Id.nullable(), updatedAt: IsoDate.nullable(), canEdit: z.boolean(),
  /** True only where the feature may be enabled (release lock lifted, or the development-only acceptance unlock). */
  released: z.boolean().optional() });
export type FeatureFlag = z.infer<typeof FeatureFlag>;

export const SHARED_DECISION_OPERATIONS = {
  shareDecision: { input: z.object({ planId: Id, requiredApprovals: z.number().int().min(1).max(3).default(1) }), output: SharedDecision },
  getSharedDecision: { input: z.object({ id: SharedDecisionId }), output: SharedDecision },
  approveSharedDecision: { input: z.object({ id: SharedDecisionId, planHash: z.string().min(1).max(200) }), output: SharedDecision },
  rejectSharedDecision: { input: z.object({ id: SharedDecisionId, reason: SharedDecisionReason }), output: SharedDecision },
  revokeSharedDecision: { input: z.object({ id: SharedDecisionId, reason: SharedDecisionReason }), output: SharedDecision },
  /** cursor = seq of the last event already received (null = from the start). nextCursor null = no more events. */
  listDecisionAudit: { input: z.object({ id: SharedDecisionId, cursor: z.number().int().min(0).nullable().default(null), limit: z.number().int().min(1).max(SHARED_DECISION_AUDIT_PAGE_MAX).default(50) }),
    output: z.object({ items: z.array(SharedDecisionAuditEvent).max(SHARED_DECISION_AUDIT_PAGE_MAX), nextCursor: z.number().int().positive().nullable() }) },
  /** Any authenticated user may read a flag (the UI hides the workspace when off); only Jira site admins (ADMINISTER) may set it. */
  getFeatureFlag: { input: z.object({ flag: FeatureFlagName }), output: FeatureFlag },
  setFeatureFlag: { input: z.object({ flag: FeatureFlagName, enabled: z.boolean() }), output: FeatureFlag }
} as const;
// END shared decision workspace

// Decision Radar (first slice): event-driven "needs review" hints. A hint, never a freshness verdict.
export const RadarFact = z.object({
  factId: z.string().max(120), type: z.enum(['LINK_CREATED', 'LINK_DELETED', 'ISSUE_DELETED']), issueIds: z.array(z.string().regex(/^\d{1,20}$/)).max(2),
  linkId: z.string().max(30).nullable(), linkType: z.string().max(60).nullable(), occurredAt: IsoDate, observedAt: IsoDate
});
export const PlanAttention = z.object({
  planId: Id,
  monitoring: z.object({ state: z.enum(['NOT_CONFIGURED', 'ACTIVE', 'DEGRADED']),
    reasons: z.array(z.enum(['NO_QUERY', 'NOT_INDEXED', 'PARTIAL_INDEX', 'INDEX_WRITE_FAILED', 'FANOUT_CAPPED', 'INVALID_EVENT', 'STORAGE_ERROR'])).max(7),
    lastObservedAt: IsoDate.nullable() }),
  coverage: z.object({ indexed: z.number().int().min(0), unindexed: z.number().int().min(0) }).nullable(),
  needsReview: z.boolean(), items: z.array(RadarFact).max(50), truncated: z.boolean(), clearedAt: IsoDate.nullable(), note: z.string().max(400)
});
export type PlanAttention = z.infer<typeof PlanAttention>;

// Release Safety Control Plane (read-only): release-level decision states over the caller's own recorded decisions.
export const RELEASE_SAFETY_LIMITS = { maxIssues: 100, pageSize: 50, maxItems: 100, maxInteractions: 50 } as const;
export const ReleaseVerdict = z.enum(['BLOCKED', 'EVIDENCE_INCOMPLETE', 'NEEDS_REVIEW', 'EXECUTION_PARTIAL', 'APPROVED_NOT_EXECUTED', 'VERIFIED_FOR_RECORDED_SCOPE']);
export type ReleaseVerdict = z.infer<typeof ReleaseVerdict>;
export const ReleaseSafetyItem = z.object({
  issue: z.object({ key: z.string().max(40), summary: z.string().max(1000), status: z.string().max(100), url: z.string().url().nullable() }),
  state: ReleaseVerdict,
  reasons: z.array(z.string().max(300)).max(6),
  decision: z.object({ planId: Id, status: z.string().max(40), verdict: z.string().max(40), currentVerdict: z.string().max(40).nullable(),
    recordedAt: IsoDate, allActionsVerified: z.boolean() }).nullable(),
  linkedKeys: z.array(z.string().max(40)).max(50)
});
export const ReleaseInteraction = z.object({
  kind: z.enum(['DIRECT_LINK', 'SHARED_DEPENDENCY']), changes: z.tuple([z.string().max(40), z.string().max(40)]), via: z.string().max(40).nullable(),
  note: z.string().max(300)
});
export const ReleaseSafety = z.object({
  scope: z.object({ projectKey: z.string().max(20), fixVersion: z.string().max(255).nullable(), jql: z.string().max(500), evaluatedAt: IsoDate }),
  verdict: ReleaseVerdict,
  verdictReasons: z.array(z.string().max(300)).max(8),
  counts: z.record(ReleaseVerdict, z.number().int().min(0)),
  items: z.array(ReleaseSafetyItem).max(RELEASE_SAFETY_LIMITS.maxItems),
  interactions: z.array(ReleaseInteraction).max(RELEASE_SAFETY_LIMITS.maxInteractions),
  coverage: z.object({ issuesRead: z.number().int().min(0), truncated: z.boolean(), interactionsTruncated: z.boolean(),
    decisionsVisible: z.number().int().min(0), unknowns: z.array(z.string().max(300)).max(8) }),
  readOnly: z.literal(true)
});
export type ReleaseSafety = z.infer<typeof ReleaseSafety>;
export type ReleaseSafetyItem = z.infer<typeof ReleaseSafetyItem>;

export const ReleaseOverview = z.object({
  projectKey: z.string().max(20), evaluatedAt: IsoDate, jql: z.string().max(500),
  releases: z.array(z.object({
    fixVersion: z.string().max(255).nullable(), releaseDate: z.string().max(10).nullable(), verdict: ReleaseVerdict,
    counts: z.record(ReleaseVerdict, z.number().int().min(0)), changes: z.number().int().min(0), interactions: z.number().int().min(0),
    topReasons: z.array(z.string().max(300)).max(3)
  })).max(50),
  truncated: z.boolean(), releasesTruncated: z.boolean(), unknowns: z.array(z.string().max(300)).max(6), readOnly: z.literal(true)
});
export type ReleaseOverview = z.infer<typeof ReleaseOverview>;

// Decision Time Machine (read-only): how a decision's evidence evolved. Only retained records; nothing reconstructed from today's Jira.
export const DECISION_HISTORY_LIMITS = { maxCheckpoints: 20, maxEdgesPerCheckpoint: 100, maxBaselineEdges: 300, maxEvents: 60 } as const;
const HistEdge = z.object({ from: Id, to: Id, kind: EdgeKind, status: EvidenceStatus });
export const DecisionCheckpoint = z.object({
  id: z.string().max(40), at: IsoDate, kind: z.enum(['BASELINE', 'CHECK']), stage: z.enum(['snapshot', 'freshness', 'approval', 'execution']),
  fresh: z.boolean(), added: z.array(HistEdge).max(100), removed: z.array(HistEdge).max(100), becameUnknown: z.array(Id).max(100),
  truncated: z.boolean(), reason: z.string().max(1000)
});
export const DecisionHistory = z.object({
  planId: Id, rootIssueKey: z.string().max(40), scenarioId: Id, status: PreventionPlan.shape.status,
  canAuthorizeExecution: z.boolean(), statusReason: z.string().max(400),
  baseline: z.object({ snapshotId: Id, capturedAt: IsoDate, evidenceState: z.enum(['LIVE', 'EXPIRED_SNAPSHOT', 'ARCHIVED']),
    edges: z.array(HistEdge).max(300), edgesTruncated: z.boolean(), scope: z.literal('CAUSAL_EDGES') }),
  checkpoints: z.array(DecisionCheckpoint).max(21), droppedCheckpoints: z.number().int().min(0),
  events: z.array(z.object({ at: IsoDate, event: z.string().max(200), source: z.enum(['PLAN_TIMELINE', 'APPROVAL', 'RADAR']) })).max(60),
  invalidation: z.object({ checkpointId: z.string().max(40), at: IsoDate, reason: z.string().max(1000) }).nullable(),
  limits: z.array(z.string().max(300)).max(6), readOnly: z.literal(true)
});
export type DecisionHistory = z.infer<typeof DecisionHistory>;
export type DecisionCheckpoint = z.infer<typeof DecisionCheckpoint>;
type HistEdgeT = DecisionCheckpoint['added'][number];
const edgeId = (e: HistEdgeT) => `${e.from}|${e.kind}|${e.to}`;
const byEdge = (a: HistEdgeT, b: HistEdgeT) => edgeId(a).localeCompare(edgeId(b));

/** Edge set recorded at a checkpoint: baseline plus that check's delta (every check is a diff against the baseline). */
export function edgesAt(baseline: HistEdgeT[], cp: DecisionCheckpoint): HistEdgeT[] {
  const m = new Map(baseline.map((e) => [edgeId(e), e]));
  for (const e of cp.removed) m.delete(edgeId(e));
  for (const e of cp.added) m.set(edgeId(e), e);
  return [...m.values()].sort(byEdge);
}

/** Deterministic comparison of two recorded checkpoints. */
export function compareCheckpoints(baseline: HistEdgeT[], a: DecisionCheckpoint, b: DecisionCheckpoint) {
  const A = new Map(edgesAt(baseline, a).map((e) => [edgeId(e), e]));
  const B = new Map(edgesAt(baseline, b).map((e) => [edgeId(e), e]));
  const added = [...B.entries()].filter(([k]) => !A.has(k)).map(([, e]) => e).sort(byEdge);
  const removed = [...A.entries()].filter(([k]) => !B.has(k)).map(([, e]) => e).sort(byEdge);
  const changedStatus = [...B.entries()].filter(([k, e]) => A.has(k) && A.get(k)!.status !== e.status)
    .map(([k, e]) => ({ edge: e, before: A.get(k)!.status, after: e.status })).sort((x, y) => byEdge(x.edge, y.edge));
  const unknownNew = b.becameUnknown.filter((n) => !a.becameUnknown.includes(n)).sort();
  return { added, removed, changedStatus, unknownNew, partial: a.truncated || b.truncated };
}


// Safe Change Composer (read-only): bounded candidate strategies evaluated by the portfolio engine. Proposals only.
const ComposerCandidate = z.object({
  candidateId: z.string().max(20), kind: z.enum(['AS_PROPOSED', 'RETAIN_OLD', 'COMPATIBLE_UPGRADE', 'RETAIN_ALL_COMPAT', 'SPLIT_PHASES']),
  name: z.string().max(120), why: z.string().max(300),
  transformations: z.array(z.object({ changeId: Id, before: ChangeOperation, after: ChangeOperation })).max(40),
  assumptions: z.array(z.string().max(300)).max(4), phases: z.array(z.array(Id)).max(10), order: z.array(Id).nullable(), cycles: z.array(z.array(Id)),
  verdict: SimulationResult.shape.verdict, blockers: z.number().int().min(0), unknowns: z.number().int().min(0), impacted: z.number().int().min(0),
  conflicts: z.number().int().min(0), conflictKinds: z.array(z.string().max(40)), requiredReviews: z.array(z.string().max(200)).max(10),
  resolvedConflicts: z.array(z.string().max(300)), remainingConflicts: z.array(z.string().max(300)),
  rank: z.number().int().min(1), dominatedBy: z.string().max(20).nullable(), resultHash: z.string()
});
export const ComposeSafeChangesResult = z.object({
  snapshotId: Id, baselineCandidateId: z.string().max(20), candidates: z.array(ComposerCandidate).min(1).max(8), truncated: z.boolean(),
  limits: z.array(z.string().max(300)).max(6), readOnly: z.literal(true)
});
export type ComposeSafeChangesResult = z.infer<typeof ComposeSafeChangesResult>;

export const OPERATIONS = {
  getCapabilities: { input: z.object({}), output: CapabilityAvailability },
  listProjects: { input: z.object({ cursor: z.string().nullable().default(null) }), output: z.object({ items: z.array(ProjectSummary), page: PageInfo }) },
  getChangeCandidates: { input: z.object({ projectId: Id, cursor: z.string().nullable().default(null) }), output: z.object({ items: z.array(JiraIssueSummary), page: PageInfo }) },
  getGraphSnapshot: { input: GraphSnapshotRequest, output: GraphSnapshot },
  getEvidenceGraph: { input: z.object({ snapshotId: Id }), output: GraphSnapshot },
  simulateChange: { input: SimulationRequest, output: z.array(SimulationResult) },
  compareScenarios: { input: SimulationRequest, output: ScenarioComparison },
  generatePreventionPlan: { input: z.object({ snapshotId: Id, scenarioId: Id }), output: PreventionPlan },
  approvePlan: { input: ApprovalRequest, output: PreventionPlan },
  executeApprovedPlan: { input: z.object({ planId: Id, idempotencyKey: z.string().min(16).max(100) }), output: z.array(ExecutionRecord) },
  getExecutionStatus: { input: z.object({ planId: Id }), output: z.array(ExecutionRecord) },
  getPreventionPassport: { input: z.object({ planId: Id }), output: PreventionPassport },
  getPolicies: { input: z.object({}), output: z.array(PolicyRule) },
  checkPlanFreshness: { input: z.object({ planId: Id }), output: EvidenceDrift },
  previewSampleProject: { input: z.object({ projectKey: z.string().regex(/^[A-Z][A-Z0-9_]+$/) }), output: SampleProjectPlan },
  createSampleProject: { input: z.object({ projectKey: z.string().regex(/^[A-Z][A-Z0-9_]+$/), confirm: z.literal(true) }), output: SampleProjectPlan },
  getValidatorPolicy: { input: z.object({}), output: ValidatorPolicy },
  simulateSlip: { input: z.object({ issueKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/), days: z.number().int().min(1).max(365) }), output: SlipSimulation },
  setValidatorPolicy: { input: z.object({ onOutage: z.enum(['ALLOW', 'BLOCK']) }), output: ValidatorPolicy },
  simulatePortfolio: { input: SimulatePortfolioRequest, output: SimulatePortfolioResult },
  getPlanAttention: { input: z.object({ planId: Id }), output: PlanAttention },
  composeSafeChanges: { input: SimulatePortfolioRequest.omit({ proposedOrder: true }), output: ComposeSafeChangesResult },
  getDecisionHistory: { input: z.object({ planId: Id }), output: DecisionHistory },
  listReleaseSafety: { input: z.object({ projectKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,19}$/) }), output: ReleaseOverview },
  getReleaseSafety: { input: z.object({ projectKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,19}$/), fixVersion: z.string().min(1).max(255).regex(/^[^"\\\n\r]+$/).nullable().default(null) }), output: ReleaseSafety },
  // shared decision workspace (see section above)
  ...SHARED_DECISION_OPERATIONS
} as const;
export type OperationName = keyof typeof OPERATIONS;
