> **Superseded by [DEVPOST_FINAL.md](DEVPOST_FINAL.md). Not for submission.** Kept for history; some values below are out of date (for example five MCP tools, now six).

# Devpost draft (English) — to be finalised with EXPERIENCE

**Name:** ANTICIPATE — The Decision Firewall for Software Teams
**Tagline:** Test the consequences. Prove the safeguards. Then ship.
**Category:** Apps for Software Teams · **Bonus:** Best app with Atlassian MCP (Teamwork Graph not claimed: the app is awaiting Atlassian allowlisting, ticket ECOHELP-180616; evidence in docs/evidence/TEAMWORK_GRAPH_ALLOWLIST.md)

## Inspiration
Retiring an old API "looks safe" in the ticket. The consumers that break are two links away, behind an issue nobody opened. Teams find out in production.

## What it does
ANTICIPATE turns a proposed change in Jira into a verifiable decision:
1. **Evidence graph** from real Jira links and components, where every relation is CONFIRMED, INFERRED or UNKNOWN — unreadable items stay UNKNOWN, never "safe".
2. **Counterfactual comparison** — remove now / retain temporarily / migrate consumers first — computed deterministically with causal paths and policy verdicts (no invented probabilities).
3. **Prevention plan** with per-action human approval; execution is leased, idempotent and **verified by re-reading Jira**; partial failures are reported as PARTIAL.
4. **Continuous Decision Safety:** if the dependency evidence changes after approval, ANTICIPATE refuses to act and shows what changed.
5. **Prevention Passport:** an audit record of evidence, alternatives, approvals, attempts and verified outcomes.
6. **Three change types:** API/component retirement, service decommission (blocked while open work still references the service) and dependency upgrades (breaking now vs backward-compatible shim vs migrate consumers first).
7. **Native Jira workflow validator:** issues labelled `anticipate-change` cannot move forward in Jira until their ANTICIPATE plan is completed and verified; the Decision Firewall works even outside the app.
8. **One-click sample data:** judges preview, then confirm, six labelled issues and four links in any project they can write to.
9. **MCP tools and a Rovo agent** (read-only): any MCP client, or the Rovo "ANTICIPATE Decision Reviewer" agent, can ask "what happens if we retire or upgrade X?" and get grounded answers; acting still requires approval in the app.

## How we built it
See docs/submission/TECHNICAL_SECTION.md (Forge global:fullPage Custom UI, Node 24 resolvers, asUser Jira REST, Forge KVS with TTL retention, rovo:mcp + rovo:agent, pure TypeScript simulation engine, shared zod contracts, 80 backend tests incl. adversarial concurrency, authorization, outage policy and a 50-cycle soak test, plus engine, contract and 60 frontend unit tests and Playwright journeys; Jira workflowValidator with admin outage policy; CI with security audit).

## Challenges
Jira's issue-link POST direction is the inverse of how links read — we found it on a real site and fixed it with a regression test. Making retries safe without transactions (marker reconciliation + atomic lease claims). Keeping AI out of the decision: agents explain, the engine decides, humans approve.

## Accomplishments
Real end-to-end run on Jira (6/6 writes verified), workflow validator blocking a real Jira transition with a clear reason, sample data created and re-read from Jira (6 issues, 4 links, idempotent), Rovo agent answering retirement and upgrade questions, refusal on evidence drift with zero writes, judge-link install verified on a clean site, a "migrate first" decision that only assumes the migration is refused by the Jira gate (shown as CLOSED in the Passport), MCP verified from an external client, 100 % precision/recall vs an independent oracle on 200 generated graphs (synthetic benchmark: it checks the engine against its own definition of impact, not field accuracy).

## What we learned / What's next
Teamwork Graph sources (PRs, deployments, Confluence) once Atlassian allowlists the app (request ECOHELP-180616); shared team workspace with separation of duties; more change types (database migrations, feature-flag removal); policy packs per team; Marketplace edition.

## Testing instructions (judges)
1. Install with the link in docs/submission/INSTALL_LINK.md on your Jira site.
2. Open `https://<site>.atlassian.net/apps/full-page/<installation-id>/hello-world/` (installation id: Apps → Manage apps).
3. In Mission Control pick a company-managed software project, click "Start the guided demo", preview the sample data, confirm (if the screen times out, preview again: creation continues server-side). Then "Analyze" the sample root, read the evidence graph, run the comparison, review and approve a plan, execute, open the Passport.
4. MCP: an org admin enables "Expose tools to MCP-compatible apps" for ANTICIPATE in admin.atlassian.com → site → Connected apps; connect a client to `https://mcp.atlassian.com/forge/39a28f48-c891-4d86-a3cf-c14409cbd29e`.

## MCP bonus write-up
Seven read-only tools (get-graph, simulate-retirement, simulate-upgrade, simulate-slip, simulate-portfolio, get-passport, check-plan-freshness), also used by the Rovo agent, exposed via `rovo:mcp`, running as the invoking user with Jira permissions enforced, deterministic outputs, prompt-injection resistant (Jira text treated as data), no mutations — acting requires explicit human approval inside ANTICIPATE.
5. Workflow validator: in a test company-managed project, Project settings, Workflows, Edit, add the rule "ANTICIPATE Decision Firewall" to a transition, publish. An issue labelled `anticipate-change` is refused until its plan is COMPLETED; other issues pass.
