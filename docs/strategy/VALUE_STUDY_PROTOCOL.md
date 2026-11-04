# Product value study — protocol, no human results yet

Date: 4 November 2026. Goal: test whether the review journey is useful and understandable, not generate an invented ROI number.

## Tasks and success criteria

| Task | Observable success | Evidence needed |
| --- | --- | --- |
| Find an indirect consumer | Names the consumer and the intermediate record, citing loaded sources and uncertainty | Graph/source interaction recording; distinguish exploration from a simulation path |
| Compare two strategies | Names shared and unique supplied impacts; recognizes migration as an assumption | Pair inspector selections, unchanged chosen decision, no resolver writes |
| Distinguish migration assumption from completion | Explains why a passing plan does not necessarily open the Jira gate | Comparison assumption and actual Passport gate reason |
| Identify a stale decision | States what changed and why approval/execution is blocked | Real invalidation notice and rejected request/no-write evidence |
| Find approval scope | Identifies actor/time and which actions/version were approved | Backend audit, respecting permission/redaction |
| Produce the decision record | Reads summary, verified/unverified actions, open questions and exports/prints | Passport screen/export/A4; check history is not described as today's Jira state |

## Four evidence classes — never combine them into one success claim

1. **Automated LOCAL/MOCK:** regression correctness, interaction paths, bounded rendering, axe/reflow and mocked resolver counts. Test driver elapsed time is not human task time or hosted latency. Current source: `tests/decision-clarity.spec.ts` and existing core/graph/Passport suites.
2. **Synthetic engine/model:** generated-graph correctness or runtime, with topology, sample size and hardware disclosed. Existing BENCHMARK.md and frontend graph benchmark are not field accuracy or customer productivity.
3. **Hosted LIVE_FORGE:** Muse records site, build, UTC timestamp, account role, source/plan IDs, expected/observed outcome and redacted captures. Existing EVIDENCE_PACK and #64/#53 are authoritative; a CI pass cannot fill this row.
4. **Human usability:** recruit appropriate reviewers with consent and authorized data; record prior Jira familiarity, task instructions, completion/error/assistance, elapsed time, confidence and the participant's explanation. No trial has been run for this protocol.

## Comparative design

Use the same seeded graph and task wording for Jira's existing workflow and ANTICIPATE. Randomize/counterbalance order; do not teach the hidden dependency in the first condition. Separate assisted from unassisted completion. Record failed or abandoned tasks and the reason, not just successful recordings. If a participant already knows the seed, mark that condition contaminated.

Keep raw timings and task-level observations, not only an average. Report sample size, exclusions, spread and limitations. Do not generalize a small convenience sample to all software teams. Ask whether the reviewer can explain an Unknown and the two confirmation steps; speed alone is insufficient for a governance tool.

## Local inspection evidence

The pairwise browser test asserts named consequences, unchanged decision selection, zero additional resolver requests, keyboard navigation and seven viewport widths in both themes. It writes labelled MOCK_TRANSPORT screenshots to `test-results/`. The Playwright report records test-driver duration; no separate task-time dataset is currently collected. It cannot establish human comprehension, purchasing intent, hosted performance or productivity gains.

## Blank human-results record

| Participant / role | Prior Jira experience | Condition / order | Task | Outcome / assistance | Time | Mistakes / explanation | Evidence consent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Not collected | — | — | — | — | — | — | — |

No ROI calculator is included: there are no measured customer inputs to justify one. If later requested, all inputs must be editable and show assumptions; the result must be labelled an illustration, not a forecast or validated saving.
