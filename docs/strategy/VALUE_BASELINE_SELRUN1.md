# Value baseline SELF-RUN #1 (TITAN-9 Epsilon, 8 Nov 2026) — NOT a human study

Operator: the builder (Muse), acting as developer-reviewer. Label: **SELF-RUN,
n=1, CONTAMINATED** (operator knew the TD seed from prior sessions — absolute
timings are illustrative lower bounds, not measurements). Method: timed,
read-only, zero Jira writes in both conditions. Protocol:
`docs/strategy/VALUE_STUDY_PROTOCOL.md` (Task 1 shape).

## Task

"Which issues are affected if TD-1 (Legacy Auth API v1) is retired, including
indirect consumers?" Dataset: TD project on dev site `one-atlas-euza`
(TD-1…TD-8, live Jira data, 8 Nov ~13:00 CET). Ground truth (both conditions
same day): 8 affected records.

## Condition A — Jira-only (manual page walk)

- Opened TD-1 (`/browse/TD-1`, 7.7 s load): 6 direct links visible
  (TD-2, TD-3, TD-5, TD-6, TD-7, TD-8). **TD-4 is invisible here** — the
  hidden indirect consumer.
- Opened each of the 6 linked issues (~5.5 s/page): TD-2's page revealed TD-4.
- 2-hop closure: 8/8 complete. Totals: **7 page loads, ~40.6 s page time**,
  plus unmeasured reading/interpretation of link types and directions.
- Failure mode observed structurally: a reviewer who stops at TD-1's own
  page (the natural first step) misses TD-4 entirely — 7/8, wrong closure.

## Condition B — ANTICIPATE-assisted (cold start, same question)

- Mission Control → select TD → type TD-1 → Analyze dependencies →
  Evidence Graph: **3 UI actions, 7.2 s** to the answer.
- Answer: 8 records / 8 relationships / 6 confirmed / 2 inferred /
  0 unknown, with per-edge provenance and hop-distance layout.
- Screenshot: `docs/evidence/hosted-2026-11-08/23-value-app-td-dev-8x.png`
  (Mission Control TD/TD-1 entry state; graph text captured same session).

## Comparison (honest)

| | Jira-only | ANTICIPATE-assisted |
|---|---|---|
| Page loads / UI actions | 7 page loads | 3 actions |
| Page/machine time | ~40.6 s (CONTAMINATED lower bound) | 7.2 s |
| Closure completeness | 8/8 only with methodical 2-hop walk; 7/8 if stopping at TD-1 | 8/8 with classification |
| Evidence classification | none (raw links) | CONFIRMED/INFERRED/UNKNOWN + provenance |
| Interpretation burden | operator reads every link | hop layout + statuses |

## Limitations (do not over-claim)

- n=1, builder-operated, contaminated seed: timings favor the builder and
  prove feasibility, not a productivity factor. No "10x", no ROI, no
  customer claims.
- One task shape (transitive closure); collision, slip, and stale-approval
  tasks were exercised but not timed comparatively (see HOSTED_ACCEPTANCE_T8
  for the DEMO 2 combined run on this same dataset).
- Human study still required: recruitment screener + consent + task script
  per VALUE_STUDY_PROTOCOL.md remain owner-gated (UNKNOWN until run).

## Reproduction

1. Condition A: open `/browse/TD-1` on the dev site, follow every linked
   issue one more hop, list the union. Count page loads.
2. Condition B: Apps → ANTICIPATE → TD → TD-1 → Analyze → Evidence Graph.
   No Jira writes occur in either path (no sample creation, approval, or
   execution was clicked).
