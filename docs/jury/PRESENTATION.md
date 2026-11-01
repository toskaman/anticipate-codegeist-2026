# ANTICIPATE — presentation copy

## Elevator pitch

Software changes cross service boundaries faster than teams can review them. ANTICIPATE is a decision firewall: inspect dependency evidence, compare consequences, and review safeguards before a risky change ships. Its Prevention Passport keeps the decision, uncertainty and approval history together.

## Problem and solution

Removing a legacy API looks like one ticket but can affect checkout, mobile clients, support integrations and release pipelines. Evidence is fragmented and missing ownership can be mistaken for safety. ANTICIPATE brings the proposed change, dependency evidence, scenario alternatives and prevention actions into one decision workflow. Unknown evidence stays visible rather than becoming a reassuring score.

## Innovation and feature explanation

The local prototype combines evidence classifications, deterministic alternative comparison and an auditable decision record. The graph distinguishes CONFIRMED, INFERRED and UNKNOWN relationships and has a textual alternative. Scenario Lab contrasts immediate removal, compatibility retention and guarded migration. Decision Firewall explains failed, passed and unknown conditions. Prevention Plan captures a local review before simulated execution. Prevention Passport exports fictional evidence, uncertainty and the local approval timeline.

## Design rationale

A restrained navy/teal interface makes dependency paths and selected alternatives prominent. Amber and explicit labels communicate uncertainty; color is never the sole status cue. Light mode, visible keyboard focus, reduced-motion behavior and a mobile dependency list support varied environments. The story moves from evidence to consequences to safeguards, so the jury can follow the decision rather than learn a dashboard taxonomy.

## Draft Devpost description

ANTICIPATE helps engineering teams test consequences before shipping a change. In our AUTH-142 demonstration, a team wants to retire legacy authentication API v1. Dependency evidence reveals affected consumers and an unresolved support integration. The team compares three authored alternatives, reviews policy conditions, examines safeguards and records a local approval. A Prevention Passport preserves the context and uncertainty for review.

The frontend currently runs locally with clearly labeled deterministic fixtures. It does not call live Jira or Confluence, enforce server-side policy, perform AI simulation or create tickets. Forge, Rovo, MCP and Teamwork Graph are integration targets for the backend team, not verified features of this local prototype. The existing Forge application's deployment identity is preserved.

## Screenshots and demonstration

Use the actual screenshots in evidence/, favoring Mission Control, selected graph evidence, Scenario Lab comparison, local approval and Passport. Avoid implying that fictional source references or simulated execution are live outputs. Follow DEMO_STORYBOARD.md for the three-minute sequence.

## Roadmap and limitations

Implemented locally: seven screens, typed provisional adapter, evidence graph, deterministic comparisons, local approval/execution, export and themes. Demonstrated with fixtures: dependency classifications, policies, safeguards and execution outcome. Awaiting backend: shared contracts, Jira/Confluence evidence, authorization, workflow enforcement, actual execution and AI. Verified against live services: none in this frontend session.

Next: agree backend payloads and capability/error semantics; integrate read-only evidence with provenance; add server-authorized plan review and execution; verify iframe CSP and bridge behavior with CORE; test live workflows with owner-provided access. Current security and visual-review limitations are tracked in STATUS.md. No hackathon eligibility, submission deadline, or scoring claims have been verified here.
