# External MCP session — slip + portfolio (12 Nov 2026, 15:49–15:50 UTC)

Client: Claude (Anthropic, Cowork desktop app; model claude-opus-5-5) via the Atlassian remote MCP connector,
ANTICIPATE **development** environment tools (`*_development`) on dev site one-atlas-euza. No tokens shown.

## 0. Control — anticipate-get-graph TD-1
8 items, 8 relations — 6 confirmed, 2 inferred, 0 unknown (snapshot snap-8712dd8d…).
TD-2/TD-3/TD-6 DEPENDS_ON TD-1, TD-4 DEPENDS_ON TD-2, TD-1 DEPENDS_ON TD-7/TD-8 [CONFIRMED].

## 1. anticipate-simulate-slip (issueKey MP-5, days 14)
"nothing was changed in Jira". Assumptions listed (blocks semantics, gap kept, no due date = UNKNOWN).
- MP-5 2026-12-01 → 2026-12-15 (+14) via MP-5
- MP-6 2026-12-04 → 2026-12-18 via MP-5 > MP-6
- MP-7 2026-12-06 → 2026-12-20 via MP-5 > MP-7
- MP-8 2026-12-08 → 2026-12-22 via MP-5 > MP-6 > MP-8
- Late release: Winter release (test) (2026-12-10) late by 12 d because of MP-8

Jira-unchanged proof: re-read via a second slip run (days 1) right after — MP-5 base due date still 2026-12-01, MP-6..MP-8 bases identical.

## 2. anticipate-simulate-portfolio (issueKey TD-1, "MIGRATE TD-1 TO TD-5; UPGRADE TD-5 breaking")
Result hash 96980da7a796608b (FNV-1a, deterministic, non-cryptographic). Combined NEEDS_REVIEW, 4 impacted (3 direct), 0 blockers, 0 unknowns, 2 conflicts; order c1 → c2.
- C1 EMERGENT_IMPACT (c1, c2): TD-2, TD-3, TD-4, TD-6 impacted only together.
- C2 MIGRATE_ONTO_RETIRED (c1, c2): migrated consumers hit again by the breaking upgrade of TD-5.
- "No Jira changes were made."

Jira-unchanged proof: get-graph TD-1 re-run after the portfolio (snapshot snap-8b41aacc…): identical 8 items / 8 relations / 6-2-0, same edges — no link created.
