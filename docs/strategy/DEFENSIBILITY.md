# Defensibility note (internal, sourced)

Date: 6 Nov 2026. Status: analysis only — buyer validation pending (see gauntlet Q2).
Rule: no "competitor lacks X" claim is made from documentation absence alone; each paragraph
below cites what a source affirmatively shows, plus retrieval date. Full brief:
`COMPETITIVE_LANDSCAPE.md`.

## What the adjacent products demonstrably do

- **Jira Plans** shows dependency lines, scheduling-violation flags and auto-scheduled dates,
  gated to Premium/Enterprise (atlassian.com/software/jira/jira/pricing; .../jira-editions;
  retrieved 2026-11-06). Descriptive planning surface, not a what-if simulator.
- **Jira Service Management** change management offers approvals, AI risk scoring and
  deployment gating via CI/CD data, Premium-gated at ~2.5x Standard cost (issuelinker.com,
  eesel.ai, motadata.com pricing pages; retrieved 2026-11-06). ITIL-change scoped.
- **Atlassian Rovo** provides AI search/chat/agents over Jira/Confluence with credit metering
  (empyra.com, stackscout.co; retrieved 2026-11-06). Probabilistic assistance, not
  deterministic verdicts.
- **Atlassian Compass** catalogues services/APIs with ownership and scorecards
  (atlassian.com/software/compass/pricing; retrieved 2026-11-06). Inventory, not decision
  enforcement.
- **ServiceNow** change management detects CI/schedule collisions with CAB workflows
  (servicenow.com/docs CAB Workbench; retrieved 2026-11-06). Schedule/CI-overlap based.
- **Harness** gates pipelines with approvals, OPA policy and deployment verification
  (harness.io/pricing + comparison guides; retrieved 2026-11-06). Pipeline-gated, post-plan.
- **GitLab** governs value streams with approvals and audit, advanced tiers quote-only
  (about.gitlab.com/pricing; retrieved 2026-11-06). Observability + gates, no collision
  simulation in reviewed pages.

## What ANTICIPATE does differently (shipped, hosted)

One Jira-native loop, each step evidenced in `docs/evidence/EVIDENCE_PACK.md` (2–5 Nov):

1. Permission-aware evidence graph (CONFIRMED/INFERRED/UNKNOWN, `asUser()` reads).
2. Deterministic pre-merge collision simulation, reproducible by hash.
3. Bounded safer alternatives ranked on the same engine (Composer).
4. Plan-hash-bound human approval with snapshot expiry.
5. Verified execution (per-action Jira read-back; 6/6 hosted).
6. Invalidation + refusal with zero writes when evidence moves (hosted 5 Nov).
7. Replayable decision history + Prevention Passport.

## Why the loop is hard to reproduce

Not the graph — the integration: per-viewer permission handling through every layer,
bit-reproducible verdicts across versions (pinned by `test/demo2-verdict-pin.test.ts`),
approval/execution/history consistency under retries, outages and revocation (lease,
idempotency, reconciliation, #144/#145 suites), and a Jira workflow gate that re-evaluates
on live evidence. Each step is buildable alone; the audited, permission-aware,
replayable whole is the work.

## What is NOT claimed

- No cross-customer data network effect exists (plans are private; no shared model).
- No reviewed source was treated as proof of a competitor's gap (see method notes).
- No buyer has confirmed switching costs or willingness to pay (gauntlet Q2/Q4).
- Atlassian could build adjacent features; the defense is workflow embedding + evidence
  quality + shipping speed, not a legal or data moat.
