# Bonus write-up (DRAFT, optional): Best Agents

Status: draft for the owner to accept or ignore at Devpost form time. Entering
more than one bonus is allowed; winning is capped at one Grand Prize + one
Bonus Prize. Team recommendation remains **Best app with Atlassian MCP**
(decision D1, `DEVPOST_FINAL.md`) unless the owner chooses otherwise.

## Text (English, paste-ready)

ANTICIPATE ships the "ANTICIPATE Decision Reviewer" Rovo agent (`rovo:agent`
in `manifest.yml`), grounded in the same deterministic engine as the app. It
answers "what happens if we retire, upgrade or delay X?" by calling read-only
actions — get-graph, simulate-retirement, simulate-upgrade, simulate-slip,
simulate-portfolio, get-passport, check-freshness — and citing the Jira
records behind each verdict. It cannot approve or execute anything: acting
requires explicit human approval inside ANTICIPATE.

- Every statement is grounded in action output; the agent prompt forbids
  inventing dependencies, keys, probabilities or savings.
- Verified answering retirement and upgrade questions from real data
  (`EVIDENCE_PACK.md`: "Hosted verification, 2 Nov", "Dependency upgrade
  use case"); slip + portfolio verified in-app, external-client run pending.
- The same actions are exposed to any MCP client through `rovo:mcp`, so the
  agent and external clients share one engine and one permission model
  (the invoking user's Jira permissions apply).

## Why this is a second lottery ticket, not the main bet

The agent is real and verified, but thin compared with dedicated agent
entries: it explains verdicts rather than running multi-step workflows.
It costs one extra form selection + this write-up, with no product change.
