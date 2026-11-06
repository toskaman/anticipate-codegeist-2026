# MCP external-client runbook: slip + portfolio (closes the 5/7 → 7/7 gap)

Goal: verify `anticipate-simulate-slip` and `anticipate-simulate-portfolio` from a real
external MCP client on the dev site, and log the rows in `EVIDENCE_PACK.md`. One admin-enabled
session. Scorecard HIGH gap; bonus-critical.

## Prerequisites (owner/admin)

1. Dev site `one-atlas-euza`, app installed (note the dev build version from Settings).
2. Org admin enables **Expose tools to MCP-compatible apps** for ANTICIPATE
   (admin.atlassian.com → site → Connected apps).
3. External MCP client (any: Claude connector, MCP Inspector, or equivalent) connected to
   `https://mcp.atlassian.com/forge/39a28f48-c891-4d86-a3cf-c14409cbd29e`.
4. Demo data present: project MP (slip; MP-5 has due dates) and project TD
   (portfolio DEMO 2 shape: TD-1…TD-8 with Blocks links).

## Session protocol

Run the control first, then the two pending tools. After each simulation, prove Jira is
unchanged (re-read the touched due dates / links). Capture verbatim Q/A (redact tokens).

### 0. Control (already verified 2 Nov — confirms the session is live)

Ask: "Show the evidence graph for TD-1."
Expect: node/edge list with CONFIRMED/INFERRED/UNKNOWN labels and Jira sources.

### 1. `anticipate-simulate-slip` (NOT_VERIFIED externally)

Ask: "What happens if MP-5 slips by 14 days?"
Expect (all read-only):

- Moved due dates along the "blocks" chain, each with its causal path.
- Late releases, if any, named by fixVersion.
- Explicit assumptions listed (e.g. weekends, unestimated issues).
- Jira unchanged afterwards: re-read MP-5 due date, confirm identical.

### 2. `anticipate-simulate-portfolio` (NOT_VERIFIED externally)

Ask: "Simulate two changes together: migrate the consumers of TD-1 to TD-5, and ship a
breaking upgrade of TD-5. Do they interact?"
Expect (all read-only):

- Individual results plus a combined result.
- `EMERGENT_IMPACT` and `MIGRATE_ONTO_RETIRED` conflicts named with change ids.
- No Jira writes: confirm no issue/link/comment created (search recent changes).

## Evidence to log in EVIDENCE_PACK.md

For each tool: client name + version, timestamp (UTC), dev build version, verbatim
question, verdict summary, Jira-unchanged proof, and the screenshot or transcript path.
On success, update `STATUS.md` (MCP row → 7/7 LIVE_FORGE), the scorecard Technology row,
and `DEVPOST_FINAL.md` evidence row "MCP from an external client".

## Failure handling

- Tool missing from client: re-check the admin Expose-tools toggle (per site) and
  reconnect; the manifest declares all 7 (`manifest.yml` `rovo:mcp`).
- Timeouts: retry once; a timeout is never a result — log it as an attempt, not a pass.
- Any Jira write observed: stop, preserve the transcript, file an issue — simulations
  must never write.
