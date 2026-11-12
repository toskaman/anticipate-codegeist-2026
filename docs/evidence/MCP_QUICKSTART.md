# ANTICIPATE MCP quick-start (judges and integrators)

Seven read-only tools that answer "what breaks if we change X?" with the same
deterministic engine as the app. Status: **7/7 EXTERNAL_MCP_VERIFIED** (slip + portfolio 12 Nov) (see
`docs/evidence/EVIDENCE_PACK.md`); `simulate-slip` and `simulate-portfolio`
are UNIT_TESTED + locally probed 7/7 and await one admin-enabled external
session (`docs/evidence/MCP_EXTERNAL_RUNBOOK.md`, #190).

## Connect (2 minutes)

1. An organization admin enables **Expose tools to MCP-compatible apps** for
   ANTICIPATE (admin.atlassian.com → site → Connected apps).
2. Connect any MCP-compatible client to
   `https://mcp.atlassian.com/forge/39a28f48-c891-4d86-a3cf-c14409cbd29e`.
3. Tools run as the invoking user: Jira permissions apply, unreadable
   evidence stays Unknown.

## The seven tools

| Tool | Inputs | Returns |
|---|---|---|
| `anticipate-get-graph` | `issueKey` | Evidence graph: CONFIRMED / INFERRED / UNKNOWN relations with Jira sources |
| `anticipate-simulate-retirement` | `issueKey`, optional `replacementIssueKey` | A/B/C verdicts (remove / retain / migrate-first) + rules + unknowns |
| `anticipate-simulate-upgrade` | `issueKey`, optional `replacementIssueKey` | Breaking / compatible / migrate-first verdicts |
| `anticipate-simulate-slip` | `issueKey`, `days` (1–365) | Moved due dates with causal paths, late releases, assumptions, unknowns |
| `anticipate-simulate-portfolio` | `issueKey`, `changes` (grammar below) | Combined + per-change verdicts, conflicts, recommended order, evidence gaps |
| `anticipate-get-passport` | `planId` (own plans) | Prevention Passport summary: option, verified actions, gate, open questions |
| `anticipate-check-plan-freshness` | `planId` (own plans) | FRESH or CHANGED with added/removed/unreadable relations |

Portfolio `changes` grammar: up to 10 clauses separated by `;`:
`REMOVE KEY | DEPRECATE KEY | UPGRADE KEY [breaking|compatible] | MIGRATE KEY TO KEY`.
Example: `REMOVE MP-5; UPGRADE MP-9 breaking`.

## Sample transcripts (LOCAL handler probe, 8 Nov — same code path as hosted)

**Graph.** Q: evidence graph for PAY-1?
`6 items, 5 relations — 4 confirmed, 0 inferred, 1 unknown.`
`- PAY-2 DEPENDS_ON PAY-1 [CONFIRMED]` … `- SEC-9 DEPENDS_ON PAY-1 [UNKNOWN]`

**Retirement.** Q: retire PAY-1?
`- A-remove-now: BLOCKED; impacted 4 (3 direct); blockers 1; unknowns 1; rules P1,P2,P3`
`- B-retain-temporarily: NEEDS_REVIEW; … Lowest-risk now: B-retain-temporarily.`
`No Jira changes were made.`

**Slip.** Q: PAY-1 slips 7 days?
`No dated issue moves. Unknown (cannot be dated, not safe): PAY-1: no due date in Jira …`
(Unknown is reported, never assumed safe.)

**Portfolio.** Q: `REMOVE PAY-1; UPGRADE PAY-2 breaking`?
`Combined verdict: BLOCKED; impacted 3 (3 direct); blockers 1; unknowns 1; conflicts 1.`
`Recommended order: c1 -> c2` + full impact report with result hash.

**Freshness.** Q: plan still fresh? `FRESH — Live Jira evidence matches the
evidence this plan was approved on.` (A changed plan reports CHANGED and is
blocked from execution server-side.)

## Safety guarantees (all tools)

- Read-only on Jira: simulations and reads never create, link, comment, or
  label. Proven by zero-write assertions in every handler test.
- No tool can approve or execute: acting requires explicit human approval
  inside the ANTICIPATE app.
- Jira text is treated as data, never instructions (injection-resistance
  tests); oversized payloads and malformed inputs return VALIDATION.
- Plans, snapshots, and passports are private to their creator
  (cross-user reads return PERMISSION_DENIED).

## Judge verification procedure (10 minutes, needs #190 session)

1. Control: "Show the evidence graph for TD-1." Expect CONFIRMED/INFERRED/
   UNKNOWN edges with Jira sources.
2. Slip: "What happens if MP-5 slips by 14 days?" Expect moved dates with
   paths, late releases, assumptions; then re-read MP-5's due date in Jira
   and confirm it is unchanged.
3. Portfolio: "Simulate: migrate TD-1 consumers to TD-5, and a breaking
   upgrade of TD-5. Do they interact?" Expect EMERGENT_IMPACT +
   MIGRATE_ONTO_RETIRED with change names; then confirm no Jira issue, link,
   or comment was created.
4. Record client name/version, UTC timestamp, build, and transcripts in
   EVIDENCE_PACK; on success update STATUS + scorecard Technology row.
