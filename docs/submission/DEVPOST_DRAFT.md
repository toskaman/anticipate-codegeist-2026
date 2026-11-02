# Devpost draft (English) — to be finalised with EXPERIENCE

**Name:** ANTICIPATE — The Decision Firewall for Software Teams
**Tagline:** Test the consequences. Prove the safeguards. Then ship.
**Category:** Apps for Software Teams · **Bonus:** Best app with Atlassian MCP (switch to Teamwork Graph only if allowlisting arrives and is demonstrated)

## Inspiration
Retiring an old API "looks safe" in the ticket. The consumers that break are two links away, behind an issue nobody opened. Teams find out in production.

## What it does
ANTICIPATE turns a proposed change in Jira into a verifiable decision:
1. **Evidence graph** from real Jira links and components, where every relation is CONFIRMED, INFERRED or UNKNOWN — unreadable items stay UNKNOWN, never "safe".
2. **Counterfactual comparison** — remove now / retain temporarily / migrate consumers first — computed deterministically with causal paths and policy verdicts (no invented probabilities).
3. **Prevention plan** with per-action human approval; execution is leased, idempotent and **verified by re-reading Jira**; partial failures are reported as PARTIAL.
4. **Continuous Decision Safety:** if the dependency evidence changes after approval, ANTICIPATE refuses to act and shows what changed.
5. **Prevention Passport:** an audit record of evidence, alternatives, approvals, attempts and verified outcomes.
6. **MCP tools** (read-only) so any MCP client — or the Rovo "Decision Reviewer" agent — can ask "what happens if we retire TD-1?" and get grounded answers; acting still requires approval in the app.

## How we built it
See docs/submission/TECHNICAL_SECTION.md (Forge global:fullPage Custom UI, Node 24 resolvers, asUser Jira REST, Forge KVS with TTL retention, rovo:mcp + rovo:agent, pure TypeScript simulation engine, shared zod contracts, 38 backend tests incl. adversarial concurrency, CI).

## Challenges
Jira's issue-link POST direction is the inverse of how links read — we found it on a real site and fixed it with a regression test. Making retries safe without transactions (marker reconciliation + atomic lease claims). Keeping AI out of the decision: agents explain, the engine decides, humans approve.

## Accomplishments
Real end-to-end run on Jira (6/6 writes verified), refusal on evidence drift with zero writes, judge-link install verified on a clean site, MCP verified from an external client, 100 % precision/recall vs an independent oracle on 200 annotated graphs.

## What we learned / What's next
Teamwork Graph sources (PRs, deployments, Confluence) once allowlisted; native Jira workflow validator; more change types (dependency upgrades, service decommission); Marketplace edition.

## Testing instructions (judges)
1. Install with the link in docs/submission/INSTALL_LINK.md on your Jira site.
2. Open `https://<site>.atlassian.net/apps/full-page/<installation-id>/hello-world/` (installation id: Apps → Manage apps).
3. Create sample data (in-app "Prepare sample data", or manually per docs/demo/JIRA_DEMO_SETUP.md), pick the change issue, read the snapshot, run the comparison, review and approve a plan, execute, open the Passport.
4. MCP: an org admin enables "Expose tools to MCP-compatible apps" for ANTICIPATE in admin.atlassian.com → site → Connected apps; connect a client to `https://mcp.atlassian.com/forge/39a28f48-c891-4d86-a3cf-c14409cbd29e`.

## MCP bonus write-up
Four read-only tools (get-graph, simulate-retirement, get-passport, check-plan-freshness) exposed via `rovo:mcp`, running as the invoking user with Jira permissions enforced, deterministic outputs, prompt-injection resistant (Jira text treated as data), no mutations — acting requires explicit human approval inside ANTICIPATE.
