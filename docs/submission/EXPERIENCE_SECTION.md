# Devpost copy — EXPERIENCE proposal (English)

Proposed final wording for the Devpost form, to merge with CORE's `DEVPOST_DRAFT.md` (CORE keeps the technical facts and hosted evidence). Not submitted. Every claim below is backed by the evidence pack or the repository tests; keep it that way when editing.

**Name:** ANTICIPATE — The Decision Firewall for Software Teams
**Tagline:** Test the consequences. Prove the safeguards. Then ship.
**Category:** Apps for Software Teams · **Bonus:** Rovo Agents, Atlassian MCP (Teamwork Graph only if integrated and demonstrated before submission)

## Inspiration

Every engineer has seen it: a ticket says "retire the old auth API", the change looks small, and something nobody looked at breaks in production. The dependency was there in Jira, two links away or mentioned in a comment. Afterwards, nobody can say what was known when the decision was made. We wanted the check to happen before the change, inside the tool where the change is planned.

## What it does

ANTICIPATE turns a proposed change in Jira into an evidence-backed decision.

- **See what depends on the change.** It reads the Jira issues and links you can access and builds an evidence graph. Each relation is Confirmed, Inferred or Unknown, with its source. Unreadable evidence stays Unknown, never "safe".
- **Compare alternatives, not just tickets.** The same evidence is simulated under different decisions: remove now, retain temporarily or migrate consumers first; for upgrades, a breaking upgrade, a backward-compatible shim or moving consumers first. Results are deterministic, with direct and indirect impact, triggered policies and the information that is still missing. No invented probabilities.
- **Understand why an option is blocked.** The Decision Firewall traces each reason from the change to the affected dependency to the policy. A suggestion is never an approval.
- **Act with accountability.** The prevention plan proposes concrete Jira actions. A person approves selected actions, then confirms execution separately. Each result is verified by reading Jira back.
- **Refuse stale decisions.** If dependencies change after approval, execution is refused and the app shows what was added, removed or became unknown.
- **Keep the record.** The Prevention Passport documents evidence, alternatives, approvals, verified outcomes and timeline, as JSON or a printable report.
- **Enforce it in Jira, optionally.** A workflow validator can stop issues labelled `anticipate-change` from moving forward until their decision is completed and live Jira links agree. "Migrate first" is a simulation assumption, so it never opens the gate on its own; the Passport shows the transition status next to the outcome. Administrators choose what happens during an outage (allow, or block).
- **Ask from Rovo.** The ANTICIPATE Decision Reviewer agent and five read-only MCP tools answer "what happens if we retire or upgrade X?" with the same engine. They cannot approve or execute.

Detecting a risk is not resolving it: ANTICIPATE shows the gap, proposes preventive actions and records which were actually done.

**Who it helps:** engineering managers reviewing risky changes, platform teams retiring or upgrading shared services, release governance, API lifecycle owners and anyone running technical change reviews in Jira.

## How we built it

Forge Custom UI (React, TypeScript) on a Jira global page; Forge resolvers calling Jira as the user; a pure TypeScript simulation and policy engine; shared zod contracts validated on both sides; Forge storage for plans, approvals and idempotent execution leases; `rovo:agent`, `rovo:mcp` and a Jira workflow validator. Two people worked in parallel: CORE (backend, engine, security, deployments) and EXPERIENCE (interface, accessibility, presentation), coordinating through written contracts and handoffs.

On the interface side: one decision journey across seven screens, a readable dependency map with an accessible list alternative, a dark default with Light, Dark and Automatic themes, a Display & accessibility menu (text size, contrast, motion, focus, simplified style), and a print layout that turns the Passport into a clean A4 report.

## Challenges

- Keeping the interface honest: never showing a capability as active just because it is declared, never treating a timeout as success or failure, never letting "Completed" read as "everything was done".
- Making a dependency graph readable for a decision-maker on any screen, down to 320 px wide.
- Safe retries without transactions: leases, idempotency keys and recovery by plan ID.
- Jira's issue-link direction, which reads the opposite way from the API; found on a real site and covered by a regression test.

## Accomplishments

- End-to-end run on a real Jira site: actions approved, executed and verified by reading Jira back.
- Evidence-changed refusal with zero writes.
- Workflow validator refusing a real Jira transition with a clear reason.
- Rovo agent answering retirement and upgrade questions from real data.
- One-minute guided demo on a blank project, with preview before any write.
- Accessibility checks on light and dark themes, mobile layouts and printed reports.

## What we learned

The valuable part is not the graph, it is the decision: comparing alternatives on the same evidence and keeping a record of who decided what, on which facts. And honesty is a feature: "Unknown" shown clearly earns more trust than a confident guess.

## What's next

Teamwork Graph sources (pull requests, deployments, Confluence) once available; more change types (database migrations, feature-flag removal); policy packs per team; shared decision history for reviewers and auditors.

## Testing instructions

1. Install with the judge link (see `docs/submission/INSTALL_LINK.md`) and open ANTICIPATE from Jira.
2. Click **Start the guided demo** and choose a company-managed software project where you can browse, create and link issues.
3. **Preview sample data**, then confirm **Create sample data** (six labelled issues, four links; about 15–20 s the first time).
4. **Analyze** the sample root, **Compare options**, **Check safeguards**, **Generate prevention plan**, approve, execute, then open the **Prevention Passport**.
5. Optional: Rovo chat → ANTICIPATE Decision Reviewer; MCP and the workflow validator need an administrator (steps in `DEVPOST_DRAFT.md`).

## Bonus write-ups (use only with the matching hosted proof)

- **Rovo agent:** "ANTICIPATE Decision Reviewer answers retirement and upgrade questions in Rovo chat from the same engine as the app. It is read-only: it explains and links to the decision, and people approve in ANTICIPATE." Proof: LIVE_FORGE on the dev site (Rovo is not available on the production clean site).
- **MCP:** "Five read-only MCP tools (evidence graph, simulate retirement, simulate upgrade, Passport, plan freshness) let an external AI client query the same decisions. Availability depends on the site and an administrator enabling MCP." Proof: external client on dev.
- **Teamwork Graph:** do not submit this bonus unless a hosted integration shows a real extra relation before the deadline.

## Wording to avoid

"Prevents every incident", "zero downtime", "predicts failures", "AI decides", "100 % secure", "certified", "cryptographic proof". Use "shows", "compares", "blocks unless", "verified by reading Jira back".
