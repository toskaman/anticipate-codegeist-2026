> **Superseded (2 Nov draft).** Its hosted-status lines are out of date: hosted runs now exist (see [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md), each result labelled LIVE_FORGE or LOCAL). Current submission text: [DEVPOST_FINAL.md](../submission/DEVPOST_FINAL.md).

# ANTICIPATE — presentation draft

Local draft for review, not a public submission. Follow docs/STATUS.md and integration/CORE_NIGHT_FOLLOWUP.md for evidence and remaining gates.

## Elevator pitch

ANTICIPATE helps engineering teams inspect dependency evidence, compare consequences and review preventive actions before a risky Jira change ships. Its Prevention Passport keeps the selected decision, approval audit, execution records and unresolved uncertainty together.

## What the product does

Mission Control selects an accessible project and change. The Evidence Graph presents explicit Jira relationships and source references, preserving CONFIRMED, INFERRED and UNKNOWN states. Scenario Lab asks the deterministic CORE engine to compare removal, temporary retention and, only when a replacement is selected, migration before retirement. The interface reports the returned verdict, policy violations, impact paths and unknowns rather than inventing probabilities or savings.

The selected snapshot/scenario produces its own versioned prevention plan. A reviewer inspects exact Jira action payloads and approves selected actions against the plan hash. Execution is a separate confirmed operation; the UI retrieves per-action status by plan ID after an uncertain response and only calls VERIFIED records verified outcomes. The Passport exports the same validated backend report used on screen.

## Technical description

The Custom UI uses React/TypeScript and the authoritative CORE 0.2.0 runtime schemas. Forge Bridge invokes typed resolver operations. Snapshot, scenario and plan identities are checked at the boundary; read errors, permission denial, rate limits, stale approvals and uncertain writes have explicit states. Graph pagination and a readable keyboard list bound the view; snapshot freshness is not mislabeled as per-edge freshness.

CORE supplies Jira extraction, deterministic simulation, policies, plan authorization, marker reconciliation and post-write checks. Its three read-only Rovo MCP tools are represented in the manifest; access depends on installation/admin enablement. A Jira workflow validator is research only, not implemented. Confluence, Teamwork Graph and paid AI are not portrayed as enabled when capabilities says otherwise.

## Evidence and limits

The frontend is wired to real resolver names and shared contracts. EXPERIENCE verified the journey with controlled transport, unit/browser checks and genuine local screenshots. Those captures are explicitly MOCK TRANSPORT. The top-level local authored prototype is separate and never mutates Atlassian. Production and a development host iframe use the connected entry and have no fixture fallback.

CORE reports an integrated development deployment of d9d6109 as v4.3.0. EXPERIENCE has not independently verified an authenticated hosted user session or real Jira write. Hosted claims must wait for that acceptance; this draft does not turn a mocked response into a real outcome. Dependency advisories, license-text review and clean-install/judge access remain release work.

## Design rationale

A restrained navy/teal shell, explicit status text, light/dark themes, keyboard focus and a mobile evidence list support review. The main progression is evidence, alternatives, policies, action review and decision record. A failed read never becomes an execution warning alone; a dismissed error never enables duplicate execution.

## Suggested Devpost summary

Software changes cross team boundaries faster than a single Jira ticket suggests. ANTICIPATE brings dependency evidence, deterministic alternatives and preventive actions into one review flow. Unknown evidence remains visible. A human reviews the exact proposed Jira actions, records an approval and separately requests execution. The Prevention Passport preserves the decision and the outcomes reported by the backend.

Before public use, replace local/mock demonstration segments only with actual authorized hosted observations. Do not claim a workflow transition was blocked, an optional integration was enabled, an action was executed, or a business impact was measured unless the corresponding evidence exists.
