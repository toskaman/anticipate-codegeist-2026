# Devpost submission — final text (English)

Paste each section into the matching Devpost field. The evidence table at the end is for the team only: every claim in the text maps to a row there. Do not add claims without adding their evidence.

**Project name:** ANTICIPATE — The Decision Firewall for Software Teams
**Tagline:** Test the consequences. Prove the safeguards. Then ship.
**Category:** Apps for Software Teams
**Bonus:** Best app with Atlassian MCP

---

## Inspiration

A ticket says "retire the old Auth API". It looks small and safe. The services that break are two links away, on an issue nobody opened, and the team finds out in production. Afterwards, nobody can show what was known when the decision was made.

Jira already holds most of that evidence in issue links. We wanted the check to happen before the change, inside Jira, with people still making the decision.

## What it does

ANTICIPATE turns a proposed change in Jira into an evidence-backed decision.

- **See what really depends on the change.** It reads the Jira issues and links you can access and builds an evidence graph. Every relation is Confirmed, Inferred or Unknown and keeps its Jira source. Unreadable evidence stays Unknown, never "safe". Indirect consumers (two or more links away) are shown with the path that reaches them.
- **Compare decisions, not just tickets.** The same evidence is simulated under several options: remove now, retain temporarily or migrate consumers first; for upgrades, a breaking upgrade, a backward-compatible shim or moving consumers first. Results are deterministic and reproducible, with direct and indirect impact, triggered policies and the open questions. "Migrate first" is labelled as an assumption: comparing options migrates nothing.
- **See what a delay would do.** "What if it slips?" delays an issue by 1–365 days and shows which due dates move along the "blocks" chain and which releases become late, from live Jira due dates and fix versions, with its assumptions listed. Simulation only: nothing changes in Jira.
- **Explain why an option is blocked.** The Decision Firewall traces each reason from the change to the affected dependency to the policy.
- **Act with accountability.** A prevention plan lists concrete Jira actions. A person approves selected actions, then confirms execution as a separate step. Each result is verified by reading Jira back.
- **Refuse stale decisions.** If the dependencies change after approval, the plan is marked Invalidated, execution is refused with zero writes, and the app shows what changed.
- **Guard the Jira transition.** An optional workflow validator stops issues labelled `anticipate-change` until their decision is completed and the live Jira links agree. A completed "migrate first" plan does not open the gate while consumers still depend on the change in Jira; once they have really migrated, it does. Administrators choose whether transitions pass or are blocked if ANTICIPATE is unavailable.
- **Keep the record.** The Prevention Passport opens with a short answer (option chosen, verified actions, transition status, open questions), then the evidence, alternatives, approvals, verified outcomes and timeline. It exports to JSON and prints as an A4 report. It is an audit-style record, not a legal or cryptographic certificate.
- **Ask from Rovo or any MCP client.** Six MCP tools that never write to Jira and the "ANTICIPATE Decision Reviewer" Rovo agent answer "what happens if we retire, upgrade or delay X?" with the same engine. They cannot approve or execute.
- **Try it in a minute.** A guided demo previews, then creates, six labelled sample issues and four links in a project you choose. Opening or previewing never writes to Jira.

Who it helps: engineering managers reviewing risky changes, platform teams retiring or upgrading shared services, release governance, and API lifecycle owners.

## How we built it

- **Forge app on Jira Cloud:** a Custom UI global page (React, TypeScript), Node.js resolvers that call Jira REST as the user so Jira permissions apply, Forge storage for snapshots, plans, approvals and execution leases, a Jira workflow validator, `rovo:mcp` tools and a `rovo:agent`.
- **Evidence graph:** a bounded, cycle-safe crawl of Jira issue links and components. Each edge keeps its Jira link id, observation time and status.
- **Deterministic engine:** a pure TypeScript simulation package applies each option to an isolated copy of a frozen snapshot, traces impact through reverse dependencies with causal paths, evaluates policies and returns a reproducible hash. No probabilities or invented savings.
- **Safe execution:** approval is bound to the plan version and expires with the snapshot. Execution takes a per-plan lease, uses idempotency keys and marker reconciliation so retries never create duplicates, and only reports Verified after re-reading Jira. Partial outcomes are reported as Partial.
- **Shared contracts:** zod schemas validate every request and response on both sides.
- **Quality:** 141 backend tests (including authorization, concurrency, outage policy and a 50-cycle soak test), 16 engine tests, 103 frontend unit tests and Playwright browser journeys with automated accessibility checks on light and dark themes. CI runs typecheck, lint, formatting, unit tests, Playwright and a security audit on every pull request.
- **Two-person team:** one owner on backend, engine, Forge and security; one on interface, accessibility and presentation, coordinating through written contracts in the repository.

## Challenges we ran into

- **Honesty in the interface.** Never showing a capability as active because it is declared; never treating a timeout as success or failure; never letting "Completed" read as "allowed to ship". This is why the Passport shows the Jira transition status next to the outcome.
- **Assumed work vs real work.** A "migrate first" plan could complete while consumers still depended on the change. The validator now re-evaluates the change on live Jira evidence before opening the gate.
- **Safe retries without transactions:** leases, idempotency keys and recovery by plan ID.
- **Jira's issue-link direction**, which reads the opposite way from the API. We found it on a real site and covered it with a regression test.

## Accomplishments that we're proud of

- A full judge journey on a brand-new Jira site, installed from the public link: sample data created and re-read from Jira, graph, comparison, verdict, approval, verified execution and a completed Passport.
- On the same site, the workflow validator refused a transition while the migration was only assumed, then allowed it once the consumers had really migrated.
- Six of six approved Jira writes verified by reading Jira back on our test site.
- Execution refused with zero writes after the evidence changed.
- MCP tools answering from an external client, and the Rovo agent answering retirement and upgrade questions from real data.
- A synthetic correctness benchmark: on 200 generated graphs, impact matches an independent oracle (precision and recall 1.0). It checks the engine against its own definition; it is not a field accuracy figure.

## What we learned

The valuable part is not the graph, it is the decision: comparing options on the same evidence and keeping a record of who decided what, on which facts. And honesty is a feature: an "Unknown" shown clearly earns more trust than a confident guess.

## What's next for ANTICIPATE

- Teamwork Graph sources (pull requests, deployments, Confluence) once Atlassian allowlists the app (request ECOHELP-180616).
- A shared decision workspace with separation of duties (a backend prototype exists; not released).
- More change types (database migrations, feature-flag removal) and policy packs per team.

## Testing instructions

1. Use a Jira Cloud site that includes Jira software projects (a free site works). Sites with only Jira Service Management cannot host the demo.
2. Install with the link in `docs/submission/INSTALL_LINK.md`, then open Jira → **Apps → ANTICIPATE**. The first open can take about 10 seconds.
3. Click **Start the guided demo**, choose a company-managed software project you can edit, **Preview sample data**, then confirm. Six labelled issues and four links are created (about 15–20 seconds the first time; if the screen waits longer, preview again: nothing is created twice).
4. **Analyze** the sample root → **Compare options** → **Check safeguards** → **Generate prevention plan** → approve **all** the actions (a partial approval ends as Partial) → execute → open the **Prevention Passport**.
5. Optional, workflow validator: Project settings → Workflows → edit a test workflow, add the rule "ANTICIPATE Decision Firewall" to a transition and publish. Issues labelled `anticipate-change` are refused until their decision is completed and Jira agrees; other issues pass.
6. Optional, MCP: an organization admin enables "Expose tools to MCP-compatible apps" for ANTICIPATE (admin.atlassian.com → site → Connected apps), then connects an MCP client to `https://mcp.atlassian.com/forge/39a28f48-c891-4d86-a3cf-c14409cbd29e`.

## Bonus write-up: Best app with Atlassian MCP

ANTICIPATE exposes six tools through `rovo:mcp` that never write to Jira: get evidence graph, simulate retirement, simulate upgrade, simulate slip, get Prevention Passport and check plan freshness. An engineer can ask an MCP client "what breaks if we retire this API?" and get the same deterministic answer as the app, grounded in the Jira links they can read.

- Tools run as the invoking user, so Jira permissions apply.
- Outputs are deterministic and cite Jira records; Jira text is treated as data, not instructions.
- No tool can approve or execute: acting requires explicit human approval inside ANTICIPATE. The freshness check may mark a stale approved plan as Invalidated, which only removes the ability to execute it.
- The same tools power the "ANTICIPATE Decision Reviewer" Rovo agent.
- Availability depends on the site and an administrator enabling MCP for the app.

---

## Evidence for each claim (team only, not for Devpost)

| Claim | Evidence |
|---|---|
| Graph from real Jira links, Confirmed/Inferred/Unknown | EVIDENCE_PACK: "Real Jira read + evidence graph" (TD), clean-site run "Analyze JDG-1" |
| Deterministic comparison, upgrade options | EVIDENCE_PACK: "A/B/C simulation + policies"; "Dependency upgrade use case" |
| "Migrate first" labelled as an assumption | EVIDENCE_PACK clean-site run: Decision Firewall "with the what-if warning"; PR #39 |
| 6/6 writes verified | EVIDENCE_PACK: "Approved writes + verification" |
| Refusal with zero writes on evidence change | EVIDENCE_PACK: "Continuous Decision Safety" |
| Validator refuses assumed migration, opens after real one | EVIDENCE_PACK: "Workflow validator on the clean judge site", 3 Nov 15:00–15:06 |
| Outage policy (admin) | EVIDENCE_PACK: hosted verification 3 Nov, outage policy rows |
| Passport short answer, transition status, A4 print | EVIDENCE_PACK: "Passport In short", "Passport print to PDF" |
| Clean-site judge journey from the public link | EVIDENCE_PACK: "Clean-site judge run, 3 Nov 2026" |
| MCP from an external client | EVIDENCE_PACK: "MCP (external client)", "MCP after rollback" |
| Rovo agent answers | EVIDENCE_PACK: "Hosted verification, 2 Nov" (Rovo chat), "Dependency upgrade use case" |
| Sample data, idempotent | EVIDENCE_PACK: "Hosted verification, 2 Nov"; clean-site run "Re-preview" |
| Test counts | Local run on main 516919e, 3 Nov 2026: backend 141, simulation-core 16, frontend unit 103 (method: docs/RELEASE.md) |
| Benchmark | `docs/evidence/BENCHMARK.md` (synthetic, 200 graphs) |
| Teamwork Graph not integrated | `docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md`, decisions.md D1 |
| Shared workspace prototype | decisions.md D3 |
| Slip simulation, sixth MCP tool | EVIDENCE_PACK: "What-if slip simulation, hosted on dev" (3 Nov, dev 6.2.0); manifest.yml `rovo:mcp` tools; PRs #59, #61, #70 |
