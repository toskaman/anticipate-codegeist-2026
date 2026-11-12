# Judge FAQ — hard questions with evidence-backed answers

For the owner at form time and for any judge reading the repo. Every
answer cites verifiable evidence, never marketing.

## 1. "Is this just a Jira dashboard / a feature Jira should have?"

No. Dashboards display; ANTICIPATE decides, enforces, and proves:
counterfactual simulation (retire/upgrade/slip/portfolio), a workflow
validator that BLOCKS transitions with an explanation, and execution
verified by Jira read-back. Evidence: `manifest.yml` (global page +
validator + rovo agent + 7 MCP actions), `docs/evidence/EVIDENCE_PACK.md`
(6/6 writes verified), judge-site validator run (3 Nov).

## 2. "Why deterministic instead of AI?"

Governance needs reproducibility: same evidence → same verdict, every
time, explainable record by record. The Rovo agent wraps the same
engine for natural language without changing verdicts, and its prompt
forbids inventing dependencies, keys, probabilities, or savings.
Evidence: `packages/simulation-core`, `manifest.yml` agent prompt.

## 3. "What happens when Jira is unreachable?"

Fail-safe and explicit: simulations need live Jira reads and say so;
the validator outage policy (ALLOW/BLOCK) is admin-switchable and
surfaced in Settings; throttles + typed retryable errors everywhere.
Evidence: `src/core/handler.ts`, `service.ts` validator policy ops.

## 4. "Can two teammates share a decision?"

Honestly: plans and snapshots are private to their creator today; a
teammate's missing decision counts as missing evidence (needs review),
and the validator enforces per-issue regardless of who decided. A
shared workspace exists behind a flag pending a hosted two-account
test (decision D3). Evidence: README limits section, `src/workspace/`.

## 5. "How do I know the execution really happened?"

Verified read-back: after each write, the app re-reads Jira and logs
the comment/issue IDs; failures surface as NOT_VERIFIED, never as
silent success. Evidence: EVIDENCE_PACK clean-site run (VERIFIED),
`HOSTED_ACCEPTANCE_T7/T8` (read-only runs, zero writes where stated).

## 6. "What data leaves Atlassian?"

Nothing. Forge-hosted compute + Forge KVS storage only; no external
HTTP calls in the backend. Evidence: `src/forge-adapters.ts` (only
`requestJira` + `kvs`), 4-scope manifest, TITAN security review.

## 7. "Your MCP claim says 5/7 externally verified — why not 7/7?"

Five tools verified from an external MCP client; slip + portfolio are
live in-app with external verification pending (#190). All seven are
read-only and share one permission model (invoker's Jira permissions).
Evidence: `docs/evidence/MCP_EXTERNAL_RUNBOOK.md`, DEVPOST_FINAL.

## 8. "What are the scale limits?"

Documented envelope with caps; overflow refuses safely instead of
degrading silently. Evidence: README limits + engine caps + overflow
tests (see RELEASE.md test inventory).

## 9. "Why you over a prettier graph/dependency app?"

Graphs show; ANTICIPATE acts: one click reveals the breaking
counterpart, the firewall blocks the bad transition, the passport
records the proof. Competitors (LinkMap, VortexWeb, JSM Ops Expert,
Greenlight) visualise, narrate, or gate — none closes the
simulate→decide→enforce→verify loop. Evidence:
`docs/strategy/COMPETITIVE_LANDSCAPE.md`.

## 10. "What breaks on a team-managed project?"

The demo does: sample creation and the validator need a
company-managed project. That is a documented prerequisite with a
how-to, not a silent failure. Evidence: INSTALL_LINK.md prerequisites.
