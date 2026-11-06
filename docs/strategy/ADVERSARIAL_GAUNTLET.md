# 30-Question Adversarial Gauntlet (TITAN re-key, verbatim questions)

Date: 6 Nov 2026. Branch: `titan/gauntlet-docs-p0`. Method: every status below is keyed to the
verbatim TITAN question text and grounded in inspected code, hosted evidence, or explicitly labelled
hypothesis. Status set: `FIXED`, `NEEDS_IMPLEMENTATION`, `NEEDS_EVIDENCE`, `ACCEPTED_LIMITATION`,
`EXTERNAL_BLOCKER`. Scorecard rule applies: nothing moves without evidence.

Status tally: FIXED 13 (Q8, Q9, Q13, Q14, Q16, Q18, Q19, Q20, Q21, Q22, Q26, Q29, Q30),
NEEDS_EVIDENCE 15 (Q1, Q2, Q3, Q4, Q5, Q6, Q10, Q11, Q12, Q15, Q17, Q23, Q25, Q27, Q28),
NEEDS_IMPLEMENTATION 2 (Q7, Q24), ACCEPTED_LIMITATION 0, EXTERNAL_BLOCKER 0 as a primary status
(TWG Q-relevant material is borderline EXTERNAL_BLOCKER but no verbatim question turns on it; see
bounty notes in `docs/strategy/COMPETITIVE_LANDSCAPE.md` and `docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md`).
Count check: 13 + 15 + 2 = 30.

Conventions: file paths are repo-relative to the deploy source (`ANTICIPATE-MUSE/` worktree).
`EVIDENCE_PACK` = `docs/evidence/EVIDENCE_PACK.md`. Labels LIVE_FORGE_PRODUCTION etc. are defined
in the pack legend.

## Cluster 1 — Brutal VC / Product Jury

### Q1. Why isn't ANTICIPATE just a Jira feature Atlassian ships next quarter?

**A. Vulnerability.** No published defensibility analysis exists; "Atlassian could build it" is a
legitimate standing objection and no buyer interview validates the moat.

**B. Hardened Technical Fix.** Evidence, not prose, is the defense, and it already exists in three
parts: (1) Jira Plans shows descriptive dependency lines and scheduling flags, not deterministic
what-if simulation (`docs/strategy/COMPETITIVE_LANDSCAPE.md` §1, sourced); (2) the reproducible
engine is pure TypeScript with stable hashes (`packages/simulation-core/src/index.ts`), so any
reimplementation must match verdicts bit-for-bit to be substitutable — add a cross-version
verdict-compatibility test pinning DEMO 2 outputs; (3) the verified-execution loop (approval bound
to plan hash + per-action Jira read-back in `src/engine/service.ts`) is a workflow Atlassian has
not shipped. Fix task: write `docs/strategy/DEFENSIBILITY.md` (1 page, sourced, no absence-claims)
and add the verdict-pinning test. Verify: test green in CI; doc reviewed against the landscape brief.

**C. Ten-Second Rebuttal.** "Plans draws the arrows; we simulate what happens if you follow them,
then prove what was approved and done — all reproducible by hash."

**Status:** `NEEDS_EVIDENCE`

### Q2. Who is the precise economic buyer, from which budget and why now?

**A. Vulnerability.** Buyer split (user / approver / buyer) is a labelled hypothesis
(`COMPETITIVE_LANDSCAPE.md` §3); zero customer interviews exist (`COMMERCIAL_STRATEGY.md`).

**B. Hardened Technical Fix.** Run the written protocol instead of debating personas:
`docs/strategy/VALUE_STUDY_PROTOCOL.md` (timed self-run on the judge dataset, labelled as such)
plus 5 interviews per persona with Van Westendorp pricing (`PERFECT_10_SCORECARD.md` Commercial
row). Record only genuine results with consent; until then every buyer claim stays
hypothesis-labelled. Verify: interview notes + pricing curves committed, or the hypothesis label stays.

**C. Ten-Second Rebuttal.** "Our buyer thesis is written down as a hypothesis, and the validation
protocol is ready — we claim no buyer we have not interviewed."

**Status:** `NEEDS_EVIDENCE`

### Q3. What are realistic Forge operating costs, gross margins and support costs?

**A. Vulnerability.** Only preliminary Forge economics exist; current prices, invocation durations
on 2.38.0, and support effort are unmeasured.

**B. Hardened Technical Fix.** Revalidate `COMMERCIAL_STRATEGY.md` unit economics against current
Forge pricing and measured invocation durations; publish one table splitting every line into
`MEASURED` / `DOCUMENTED PLATFORM FACT` / `MODELED ASSUMPTION` / `UNKNOWN` (users per site,
decision journeys, storage I/O, retention, logging, Marketplace fees, support hours). Verify:
each MEASURED cell links to a run; each UNKNOWN cell names the experiment that would resolve it.

**C. Ten-Second Rebuttal.** "We publish our cost model with every assumption labelled — measured
cells link to runs, unknowns name their experiment."

**Status:** `NEEDS_EVIDENCE`

### Q4. How will the first 1,000 legitimate users be acquired with minimal marketing spend?

**A. Vulnerability.** No validated acquisition channel; Marketplace listing is not started and the
jury share-link must not be broken (`COMPETITION_PROGRAM.md` §C).

**B. Hardened Technical Fix.** Ship the low-cost funnel that already has its parts: public install
link (exists, `docs/submission/INSTALL_LINK.md`) + 60-second guided demo (exists, idempotent
sample data) + Marketplace submitted-for-review listing (allowed by Codegeist rules via review
ticket) + docs-first onboarding. Instrument install→demo→first-verified-decision conversion and
report the funnel weekly. Verify: funnel numbers from real installs, never projections.

**C. Ten-Second Rebuttal.** "Install link, one-minute guided demo, Marketplace listing — and we
measure the funnel instead of projecting it."

**Status:** `NEEDS_EVIDENCE`

### Q5. Why would customers use the product repeatedly rather than only during major incidents?

**A. Vulnerability.** No retention or repeat-use data; the "every release" story is design intent.

**B. Hardened Technical Fix.** The product already embeds in the weekly loop (Release Safety per
fixVersion, Radar needs-review hints, validator gate on the transition); what is missing is the
measurement. Define "weekly active release decision" (simulation, approval, or verified execution
per site-week), log it from existing ops, and set the retention target before observing data.
Verify: 8 weeks of site-week activity, reported with cohort sizes.

**C. Ten-Second Rebuttal.** "Releases happen weekly, and Release Safety, Radar and the gate live in
that loop — we will prove repeat use with site-week activity, not anecdotes."

**Status:** `NEEDS_EVIDENCE`

### Q6. What defensibility exists against ServiceNow, Atlassian, Harness and GitLab?

**A. Vulnerability.** The competitive brief is sourced but snippet-level for some vendors, and no
buyer has confirmed switching costs.

**B. Hardened Technical Fix.** Keep the honest frame: ServiceNow detects schedule/CI collisions in
ITIL change flows, Harness gates pipelines with OPA, GitLab governs value streams — none ships
deterministic pre-merge collision simulation plus verified execution plus replayable history as one
Jira-native loop (synthesis of reviewed capability pages, `COMPETITIVE_LANDSCAPE.md` §1). Fix:
finish the pending page re-check (#64), write the 1-page defensibility note (see Q1), and confirm
with buyer interviews that the embedded workflow (validator + history + passport) is the stickiness.
Verify: re-check dated; no "lacks feature" claim without a reliable source.

**C. Ten-Second Rebuttal.** "They gate pipelines or calendars; we simulate the collision before the
change exists, then prove what happened — inside Jira."

**Status:** `NEEDS_EVIDENCE`

### Q7. What concrete commercial deliverable survives after Codegeist ends?

**A. Vulnerability.** Marketplace licensing, pricing, listing copy and admin guide are NOT STARTED;
privacy/support docs are drafts (`COMMERCIAL_STRATEGY.md` checklist).

**B. Hardened Technical Fix.** Build the survival kit on a branch, without touching the jury
install: (1) Marketplace listing packaged for submitted-for-review (description, screenshots from
hosted runs, install guide, support + privacy URLs, security self-assessment); (2) admin guide for
the validator and outage policy (exists as draft — finish it); (3) licensing decision signed by
both owners (50/50 IP, no unilateral transfer). Verify: review-ticket link obtained; jury link
smoke-tested unchanged before and after.

**C. Ten-Second Rebuttal.** "A review-ready Marketplace listing, a finished admin guide, and
licensing both owners signed — the jury install untouched."

**Status:** `NEEDS_IMPLEMENTATION`

## Cluster 2 — Senior AI / ML Architect

### Q8. How do you prevent fabricated dependencies and invalid decisions?

**A. Vulnerability.** Any inferred relation could be mistaken for ground truth if the UI ever
presented it as confirmed.

**B. Hardened Technical Fix.** Already built, in three layers: (1) every relation carries
CONFIRMED / INFERRED / UNKNOWN with its Jira source (`src/jira/extractor.ts`, bounded crawl;
unreadable stays UNKNOWN, never "safe"); (2) simulations run on a frozen snapshot and every
result carries a reproducible hash (`packages/simulation-core/src/index.ts`); (3) changed
evidence invalidates approvals — `guardFreshEvidence` runs pre-approval and pre-execution
(`src/engine/service.ts`), execution is refused with zero writes, and the UI lists what changed
(hosted: plan-4ac3c031 refused; 5 Nov prod invalidation replay). Verify: existing drift tests +
hosted DEMO 3; no probabilities are emitted anywhere by design (EVIDENCE_PACK).

**C. Ten-Second Rebuttal.** "Every relation is labelled Confirmed, Inferred or Unknown — and if
the evidence moves, the approval dies with zero writes."

**Status:** `FIXED`

### Q9. Why is deterministic simulation preferable to using an LLM for every verdict?

**A. Vulnerability.** A judge may assume the "AI" verdicts come from a model and can hallucinate.

**B. Hardened Technical Fix.** No verdict comes from a model: verdicts are pure functions
(cycle-safe BFS + policy rules + canonical stable hash) over a frozen snapshot, so the same
evidence always yields the same BLOCKED / NEEDS_REVIEW / PASS. The Rovo agent narrates grounded
tool outputs only — its prompt forbids inventing dependencies or probabilities (`manifest.yml`
rovo:agent), and its tools are read-only deterministic actions. Reproducibility is testable:
re-running a simulation returns the same result hash. Verify: `test/composer.test.ts`
determinism + input-order-independence tests; contract `resultHash` on every result.

**C. Ten-Second Rebuttal.** "Models narrate; they never judge. Every verdict is a pure function
you can re-run to the same hash."

**Status:** `FIXED`

### Q10. What is the measured latency budget, including Forge cold starts?

**A. Vulnerability.** The only hosted latency numbers (first open ~2.6 s warm, ~3.9 s backend-cold,
up to ~9.3 s right after a deploy) were measured 3 Nov on production 2.30.0 — stale for 2.38.0 —
and no per-operation budget table exists.

**B. Hardened Technical Fix.** Re-measure on production 2.38.0 (warm open, backend-cold open,
post-deploy open) plus per-op p50/p95 for getGraphSnapshot, compareScenarios/simulatePortfolio,
approvePlan, executeApprovedPlan, checkPlanFreshness; publish the budget table in `RELEASE.md`
with method and dataset size. Existing anchors: 10-parallel bursts on dev (listProjects 30/30
p95 1.9 s, getGraphSnapshot 20/20 p95 2.6 s) and the ~18 ms engine figure for a 100-node
3-scenario comparison. Verify: dated runs on the current build; budget violations fail the
release gate.

**C. Ten-Second Rebuttal.** "We publish a measured latency budget per operation, cold starts
included — re-measured on every release, not quoted from memory."

**Status:** `NEEDS_EVIDENCE`

### Q11. Where are the independent correctness benchmarks and baseline comparisons?

**A. Vulnerability.** The 200-graph oracle check (precision/recall 1.0, `docs/evidence/BENCHMARK.md`)
is synthetic self-consistency against the engine's own definition — not field accuracy and not a
baseline comparison.

**B. Hardened Technical Fix.** Keep the synthetic benchmark labelled as what it is, and add the
missing comparison: run `VALUE_STUDY_PROTOCOL.md` (timed decision task on the judge dataset,
ANTICIPATE vs manual Jira inspection, self-run and labelled as such) and report time-to-correct-
verdict with the protocol attached. Do not claim field accuracy from synthetic graphs. Verify:
protocol + raw timings committed; any "10x" style claim traces to that table or is removed.

**C. Ten-Second Rebuttal.** "Our synthetic benchmark proves the engine matches its own spec; the
human baseline study is protocolled and next — we claim nothing beyond each label."

**Status:** `NEEDS_EVIDENCE`

### Q12. How are Jira prompt injections and untrusted MCP content contained?

**A. Vulnerability.** Containment architecture exists, but no adversarial injection test is
evidenced: Jira text shaped as instructions must be proven unable to alter a verdict, an approval,
or tool output.

**B. Hardened Technical Fix.** Harden in this order: (1) document the existing containment —
Jira text is data (never concatenated into an agent system prompt), all 7 MCP tools are read-only
GET actions that cannot approve or execute, every request/response is zod-validated
(`packages/contracts/src/index.ts`), React escapes rendered text by default; (2) add adversarial
tests: Jira summaries containing instruction-like text ("ignore previous rules", fake CONFIRMED
claims, oversized payloads) must yield identical verdict hashes and identical tool outputs as
neutral text. Verify: new injection test file green in CI; contract payload caps asserted.

**C. Ten-Second Rebuttal.** "Jira text is data, never instructions — and we will show the
adversarial test where injected orders change nothing."

**Status:** `NEEDS_EVIDENCE`

### Q13. What happens if Rovo model behavior changes?

**A. Vulnerability.** A model upgrade could change narration quality or tool-call phrasing.

**B. Hardened Technical Fix.** Blast radius is nil by architecture: verdicts, approvals, execution
gates and hashes never pass through the model — they come from the deterministic engine and the
service layer. Rovo only phrases grounded tool outputs, and its tools are read-only. If narration
degrades, the product still decides correctly; the fallback is the app UI showing the same engine
results. Verify: engine + service test suites run with no model involved (they do — pure
unit/integration tests).

**C. Ten-Second Rebuttal.** "The model can change its words, never our verdicts — decisions are
computed, not generated."

**Status:** `FIXED`

### Q14. Why is this architecture preferable to a local small language model?

**A. Vulnerability.** "Why not run a small model locally?" is a fair efficiency challenge.

**B. Hardened Technical Fix.** The answer is that no model is needed for the decision at all: the
verdict path is a pure function (~18 ms for 100 nodes / 3 scenarios) running in the Forge
resolver next to the data, with zero model hosting, zero GPU cost, zero nondeterminism, and
bit-reproducible hashes an auditor can re-run. An SLM would add hosting cost, latency, and
probabilistic outputs to a path that is currently exact. Models are used only where language
helps (Rovo narration of grounded results). Verify: engine timing test + resolver bundle contains
no model dependency.

**C. Ten-Second Rebuttal.** "Our verdicts run in milliseconds with no model at all — exact,
auditable, and free of GPU bills."

**Status:** `FIXED`

## Cluster 3 — Principal Systems Engineer

### Q15. What happens under 10,000 simultaneous requests, considering actual Forge quotas?

**A. Vulnerability.** No 10k load evidence exists; claiming support would be fabrication. Forge
quotas, KVS throttling and Jira rate limits bound real capacity.

**B. Hardened Technical Fix.** Publish an explicit capacity envelope instead of a scale claim:
(1) per-op cost model from measured durations; (2) throttle behavior — fail-open on storage
errors with per-operation Jira authorization still enforced (decisions.md D7), request limits
implemented and being hardened after the 2.31.0 KVS incident (see EVIDENCE_PACK + the throttle
wiring test that now passes identity through the runtime payload); (3) degradation strategy:
bounded crawls (depth ≤ 5, ≤ 200 live nodes), truncation flags, `RATE_LIMITED` /
`UPSTREAM_UNAVAILABLE` / `BUDGET_EXCEEDED` error codes, honest retryable flags. Extend the
10-parallel burst tests toward larger bursts on dev and record where the envelope breaks. Verify:
dated burst runs; envelope doc cites quota sources.

**C. Ten-Second Rebuttal.** "We publish our capacity envelope and degradation path — and we claim
no load level we have not measured."

**Status:** `NEEDS_EVIDENCE`

### Q16. Which Jira or Forge outage produces degraded behavior?

**A. Vulnerability.** A gate that fails closed during an outage could stop a business; a gate that
fails open could wave through risk.

**B. Hardened Technical Fix.** Already explicit and hosted-verified: the workflow validator outage
policy defaults to Allow and is switchable to Block by Jira admins only (hosted 3 Nov: Allow →
Block → Allow persisted; non-admin read-only). Storage faults are covered by fault-injection
tests around the approval path (#145); the throttle fails open on storage errors while every
operation still enforces its own Jira authorization (D7). Timeouts after writes reconcile by
read-back instead of guessing (CONFLICT path verified hosted 3 Nov). Verify: existing hosted
rows + `#145` suite; admin guide documents the policy choice.

**C. Ten-Second Rebuttal.** "Outages degrade honestly: the gate policy is the admin's explicit
choice, and a timeout never becomes a verdict."

**Status:** `FIXED`

### Q17. What are the measured memory footprint, cold-start and computation costs?

**A. Vulnerability.** Latency numbers exist but are stale (see Q10); resolver memory footprint was
never profiled; engine compute cost is a single ~18 ms figure.

**B. Hardened Technical Fix.** Measure all three on the current build: (1) cold/warm open timings
on production 2.38.0 (Q10 protocol); (2) resolver memory high-water per op (getGraphSnapshot,
simulatePortfolio, composeSafeChanges, executeApprovedPlan) against the 1024 MB allocation in
`manifest.yml`; (3) engine timings across graph sizes (100 / 500 / 2000 nodes) to confirm the
bounded-crawl cost curve. Publish in `RELEASE.md` with method. Verify: dated measurements;
memory headroom stated per op.

**C. Ten-Second Rebuttal.** "Timings, memory high-water and the cost curve, measured on the
shipping build — the table is in the release record."

**Status:** `NEEDS_EVIDENCE`

### Q18. Can sensitive enterprise Jira data leave authorized trust boundaries?

**A. Vulnerability.** Any cross-user leak or external exfiltration path would be disqualifying for
enterprise use.

**B. Hardened Technical Fix.** Boundaries are structural: all user-initiated Jira reads/writes run
`asUser()`, so Jira enforces the viewer's own permissions; `mypermissions` is checked right
before any write; plans are private to their creator; data lives only in Jira and Forge storage
(scopes `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app` — no graph scopes,
no external calls from the decision path); cross-user access is covered by authorization tests
including the shared-decision bypass fix (#144, every refusal asserting zero Jira writes).
Shared decisions stay release-locked (`SHARED_DECISIONS_RELEASED = false`) until hosted
two-account acceptance (#131) passes. Verify: authorization suite green; #131 run before any
unlock; `docs/security/THREAT_MODEL.md` current.

**C. Ten-Second Rebuttal.** "Reads run as you, plans are private to you, data never leaves Jira
and Forge — and sharing stays locked until two-account tests pass."

**Status:** `FIXED`

### Q19. How are duplicate writes prevented after retries or lost responses?

**A. Vulnerability.** A retry or lost response that double-creates Jira issues would corrupt the
record the product exists to keep.

**B. Hardened Technical Fix.** Three mechanisms, all tested: per-plan execution lease
(`executeApprovedPlan`), idempotency keys on approval and execution, and marker
reconciliation — labels/comments are read back before any create, so a retried execution finds
its own markers and creates nothing twice (`src/engine/service.ts`, `src/engine/plans.ts`).
Coverage: a 50-cycle soak test for idempotency, the guided-demo CONFLICT guard (re-preview shows
EXISTS, verified hosted on MP/AVT/MOBL), and 6/6 approved writes verified by Jira read-back.
Verify: soak + CONFLICT suites green; hosted re-preview row in EVIDENCE_PACK.

**C. Ten-Second Rebuttal.** "Leases, idempotency keys, and read-back reconciliation — retries find
their own markers and create nothing twice."

**Status:** `FIXED`

### Q20. What functions remain usable during network loss, and which must fail safely?

**A. Vulnerability.** A Forge-hosted app cannot work offline; any claim of offline execution would
be false, and any timeout misread as success would corrupt decisions.

**B. Hardened Technical Fix.** State the boundary plainly: with connectivity lost, no online
function executes — the app shows an honest degraded/unavailable state, never a verdict. What
fails safely by design: (1) timeout after write → automatic read-only re-check instead of a
TIMEOUT error (the 2 Nov hosted bug, fixed and verified via the CONFLICT path 3 Nov); (2) partial
outcomes reported as Partial, never Completed; (3) unverified actions never marked VERIFIED;
(4) unknown evidence never shown as safe. No cached verdict may authorize execution — approvals
expire with the snapshot and re-check live links. Verify: timeout/reconciliation tests green;
UI copy audit for "never a verdict without connectivity".

**C. Ten-Second Rebuttal.** "Offline, we decide nothing — and every timeout reconciles by
re-reading reality instead of guessing."

**Status:** `FIXED`

## Cluster 4 — Live-Demo Saboteur and Hackathon Judge

### Q21. What happens with malformed, empty or adversarial input?

**A. Vulnerability.** Malformed candidates, empty graphs, or adversarial payloads must be refused
with a clear reason — never rendered as a verdict, never executed.

**B. Hardened Technical Fix.** Already layered: shared zod schemas validate every request and
response on both sides (`packages/contracts/src/index.ts`, incl. `ComposerCandidate` with
transformation pairs and payload size caps); the crawler, portfolio and composer are bounded
(`PORTFOLIO_LIMITS`, `COMPOSER_LIMITS`, truncation flags); empty snapshots yield explicit
empty states, not PASS. Remaining hardening (this branch, P0-C1): a contract test asserting
malformed candidate transforms are rejected before any simulation runs. Verify: contract suite +
new rejection test green; UI shows refusal copy, never a partial verdict.

**C. Ten-Second Rebuttal.** "Bad input dies at the contract boundary with a clear reason — it can
never become a verdict or a Jira write."

**Status:** `FIXED`

### Q22. What happens if a judge supplies an arbitrary URL, PDF or unsupported dataset?

**A. Vulnerability.** Scope creep into a generic importer would be dishonest engineering done to
please one question.

**B. Hardened Technical Fix.** No such ingestion surface exists, by design: the app reads only
Jira issues, links and components through `asUser()` on the installed site, plus its own
explicitly-labelled demo fixtures (`DEMO_FIXTURE` mode, never mixed with live data). There is no
URL fetch, no PDF parser, no dataset importer to exploit — an unsupported input has nowhere to
go, and the testing instructions (`DEVPOST_FINAL.md`) define exactly what the judge provides (a
Jira site + a project). If a future import is ever added, it ships with an explicit allowlist and
refusal copy. Verify: attack-surface review confirms no fetch/parse path outside Jira REST.

**C. Ten-Second Rebuttal.** "We read your Jira and nothing else — there is no importer to feed a
PDF to, and that is a deliberate boundary."

**Status:** `FIXED`

### Q23. How can the judge verify that displayed metrics and results are real?

**A. Vulnerability.** Counts drifted across documents (fixed this branch), the judge site is stale
since 2.35, and no recount ran for #177+ — a judge re-running today could see different numbers
than the text.

**B. Hardened Technical Fix.** Make verification mechanical: (1) `RELEASE.md` is the single source
for versions/counts (repaired this branch); (2) every simulation carries a reproducible
`resultHash` a judge can re-run; (3) the clean-site judge journey is scripted step-by-step in
`DEVPOST_FINAL.md` testing instructions and was passed 3 Nov from the public link; (4) at freeze:
recount tests, re-run the judge site on the shipping build, re-capture hosted screenshots, and
fill the EVIDENCE_PACK "proofs still missing" table or mark each row done. Verify: a second
person follows the instructions on a clean site and reproduces the Passport.

**C. Ten-Second Rebuttal.** "Re-run any simulation to its hash, or replay the scripted judge
journey on a clean site — both are written down."

**Status:** `NEEDS_EVIDENCE`

### Q24. What authentic first-15-second moment communicates exceptional value?

**A. Vulnerability.** No video exists (`CODEGEIST_COMPLIANCE.md`: video FAIL, verdict NO-GO;
Presentation 4/10) — the strongest moment is designed but unrecorded.

**B. Hardened Technical Fix.** The moment is DEMO 2 on production: two changes that pass alone,
shown colliding the instant they are simulated together (EMERGENT_IMPACT + MIGRATE_ONTO_RETIRED
on ADM, hosted 5 Nov on 2.37.0 with screenshots). Record `docs/submission/VIDEO_SCRIPT.md` v2
(4:20 plan, production-observed scenes) with the collision inside the first 15 seconds and the
visual climax near 0:50; keep the first 3 minutes standalone per the rules. Verify: published
unlisted YouTube link + shot checklist, all footage from the shipping build.

**C. Ten-Second Rebuttal.** "Two safe changes, one screen, instant collision — the first fifteen
seconds are the product, not a pitch."

**Status:** `NEEDS_IMPLEMENTATION`

## Cluster 5 — Grandmaster Elevation

### Q25. What genuine 10x workflow improvement can we demonstrate or measure?

**A. Vulnerability.** No measured improvement factor exists; "10x" without a protocol would be a
fabricated metric.

**B. Hardened Technical Fix.** Do not claim 10x — measure the thing that could justify a factor:
time-to-correct-verdict for a representative retirement/upgrade decision, ANTICIPATE vs manual
Jira inspection, using `VALUE_STUDY_PROTOCOL.md` on the judge dataset (self-run, labelled as
such), reporting raw timings and the protocol. Candidate mechanisms for a large factor (to be
confirmed by the study, not asserted): indirect-consumer tracing across N links in one view,
instant re-simulation of alternatives, and automatic invalidation instead of re-auditing.
Verify: committed timings; any factor quoted traces to that table.

**C. Ten-Second Rebuttal.** "We will not say ten until we have timed it — the protocol is written,
the dataset is ready, the timings will be public."

**Status:** `NEEDS_EVIDENCE`

### Q26. How does ANTICIPATE advance Atlassian's mission of connected teamwork?

**A. Vulnerability.** A generic "we connect teams" claim would be indistinguishable from any
integration pitch.

**B. Hardened Technical Fix.** Ground it in shipped connections: Jira evidence becomes shared
team context (evidence graph with per-viewer permissions); decisions become team memory
(Time Machine checkpoints, Prevention Passport, audit trail); the workflow validator embeds the
team's decision in the developer's transition; Rovo and 7 MCP tools expose the same engine to
agents and external clients. Each connection is a merged, hosted capability, not a slide.
Verify: judge journey traverses Jira → app → validator → Rovo/MCP without leaving the
Atlassian surface.

**C. Ten-Second Rebuttal.** "Jira holds the evidence, the team makes the call, the record stays
where the work happens — connected, not exported."

**Status:** `FIXED`

### Q27. Does the product have a genuine compounding product advantage?

**A. Vulnerability.** No cross-customer data network effect exists and none is claimed honestly;
usage/retention that would prove site-local compounding is unmeasured.

**B. Hardened Technical Fix.** Claim only the compounding that is real and measurable: per-site
decision history grows (checkpoints, invalidations, verified outcomes), making each later
decision faster to review and audit — Time Machine and Passport are the compounding surface.
Explicitly disclaim cross-site learning (plans are private; no shared model). Define the metric:
median time from simulation to verified execution per site-month, expected to fall as history
accumulates. Verify: site-month trend data; no "network effects" language anywhere in
submission materials.

**C. Ten-Second Rebuttal.** "Every decision your team records makes the next one faster to review
— compounding history, not a data-moat fantasy."

**Status:** `NEEDS_EVIDENCE`

### Q28. Is there a verified regulatory or governance driver creating demand, without claiming a nonexistent legal mandate?

**A. Vulnerability.** No compliance mapping exists; inventing a legal mandate would be a
credibility-ending misstep.

**B. Hardened Technical Fix.** Hold the line: the product keeps audit-style records (who approved
what, on which evidence, with verified outcomes and timelines) that governance buyers can map to
their own controls — but ANTICIPATE claims no certification, no mandate, and no legal standing
(the Passport states it is "an audit-style record, not a legal or cryptographic certificate").
Fix: add a controls-mapping appendix that lists, for common change-governance questions, which
product record answers each — phrased as buyer-mappable evidence, never as compliance.
Verify: legal review of the appendix wording; zero mandate language in Devpost/video.

**C. Ten-Second Rebuttal.** "We keep the records governance teams wish they had — and we claim no
law that says you must buy us."

**Status:** `NEEDS_EVIDENCE`

### Q29. Which underlying engineering achievement is difficult to reproduce and easy to demonstrate?

**A. Vulnerability.** If everything looks easy, nothing defends the Technology and Innovation scores.

**B. Hardened Technical Fix.** Name it precisely: the deterministic collision→alternative→approval→
verified-execution→invalidation loop over live Jira evidence, reproducible by hash. DEMO 2 shows
the emergent impact absent from either change alone; the Composer ranks a 0-conflict alternative
on the same engine; approval binds to the plan hash; execution verifies by read-back; a later
link change invalidates and refuses with zero writes — all observed on production 2.37.0
(EVIDENCE_PACK 5 Nov session). Each step is individually buildable; the integrated,
permission-aware, replayable loop is the hard part. Verify: the 5 Nov session rows + the
end-to-end judge journey.

**C. Ten-Second Rebuttal.** "Anyone can draw a graph — try reproducing our whole loop live: collide,
reroute, approve, verify, invalidate, refuse."

**Status:** `FIXED`

### Q30. What precise sentence should a judge remember when comparing ANTICIPATE with other submissions?

**A. Vulnerability.** A forgettable or overclaiming tagline wastes the comparison moment.

**B. Hardened Technical Fix.** One sentence, every clause evidenced: "Most tools show you what
changed — ANTICIPATE simulates what would break, proposes a safer path, and proves what was
authorized." (Simulate: deterministic engine + hosted DEMO 2. Propose: Composer ranked #1
0-conflict alternative on production. Prove: plan-hash approvals + 6/6 read-back-verified writes
+ invalidation refusals with zero writes.) Use verbatim in video close, Devpost tagline block,
and pitch. Verify: each clause traces to an EVIDENCE_PACK row.

**C. Ten-Second Rebuttal.** "Most tools show you what changed — we simulate what would break,
propose a safer path, and prove what was authorized."

**Status:** `FIXED`

## P0 follow-through (spawned from this gauntlet)

Continuity contracts (composer → decision), files and tests:

- P0-C1 candidate validation: `ComposerCandidate` zod schema exists
  (`packages/contracts/src/index.ts`); add a rejection test for malformed transforms.
- P0-C2 selection → snapshot binding: selection prefills the client editor
  (`PortfolioPanel.tsx:556`); the server re-simulates on the next `simulatePortfolio` call —
  add a client/server verdict-equality test proving no client verdict is trusted.
- P0-C3 snapshot freshness on the composer path: `guardFreshEvidence` + `linksDigest` exist —
  add a stale-snapshot → `STALE_APPROVAL` test through the composer-originated plan.
- P0-C4 approval derivation: plan-hash binding exists (`approvePlan`) — add a tamper test
  (mutated candidate/plan fails the hash check).
- P0-C5 verified execution for composer origin: per-action loop + lease + read-back exist —
  extend Playwright e2e to assert per-action VERIFIED on a composer-originated plan.
- P0-C6 passport provenance: `ProvRec` + `getPreventionPassport` exist — assert the composer
  provenance chain appears in the Passport and in Rovo `get-passport`.

Global P0s: G1 record video (Q24); G2 judge-site re-check on the shipping build (Q23);
G3 MCP slip/portfolio external-client run (scorecard HIGH gap); G4 #131 two-account acceptance
(keep release-locked until pass); G5 source-tree clarity (deploy source = this tree,
`RELEASE.md`); G6 freeze-time recount + doc re-sync (Q23).
