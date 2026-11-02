# Jury evidence pack (CORE)

| Feature | Commit/branch | Env | Dataset | Date | Procedure | Expected | Observed | Limitation |
|---|---|---|---|---|---|---|---|---|
| Install via judge link on clean site | prod 2.1.0+ | toskaman5962 (prod) | none | 2026-11-02 | open docs/submission/INSTALL_LINK.md, Get app, choose site | install OK, app opens, honest empty state | "Installation successful"; "No projects available… no demonstration project is inserted" | sample project needs UI button |
| Real Jira read + evidence graph | dev | one-atlas-euza | TD-1…TD-8 | 2026-11-02 | Mission Control → TD → TD-1 → snapshot | CONFIRMED/INFERRED edges from real links | 8 nodes / 7–8 relations | Jira links only (TWG pending) |
| A/B/C simulation + policies | dev | one-atlas-euza | TD | 2026-11-02 | Scenario Lab (replacement TD-5) | A BLOCKED, B NEEDS_REVIEW, C PASS | as expected | deterministic; no probabilities by design |
| Approved writes + verification | dev | one-atlas-euza | TD | 2026-11-02 11:30 UTC | approve 6 actions, execute | 6 VERIFIED, TD-7/TD-8 created and "block" TD-1 | 6/6 VERIFIED; Jira page shows links + decision comment | — |
| Prevention Passport | dev | one-atlas-euza | plan-a2f3db9f… | 2026-11-02 | MCP get-passport | COMPLETED, 6 VERIFIED | as expected | — |
| Continuous Decision Safety | 070b0f6+ | one-atlas-euza dev 4.12.0 | plan-4ac3c031… | 2026-11-02 ~14:30 UTC | approve → add Jira link TD-6 blocked by TD-1 → execute | refused, 0 writes | status EVIDENCE_CHANGED, 0 executions | UI does not yet show the reason |
| MCP (external client) | dev | Claude connector, one-atlas-euza | TD | 2026-11-02 | get-graph / simulate-retirement / get-passport | grounded read-only answers | as expected | requires admin "Expose tools" toggle per site |
| Benchmark | feat/core-engine | local | synthetic 200 graphs | 2026-11-02 | npm test | P=R=1 vs oracle | see BENCHMARK.md | synthetic |
| Rovo agent | dev 4.13.0+ | one-atlas-euza | — | 2026-11-02 | Jira issue → Agents → search | agent listed | NOT FOUND yet ("check the agent is enabled in Studio") | needs Rovo Studio enablement by admin |
| Teamwork Graph | — | — | — | — | — | — | BLOCKED: allowlist request sent 2026-11-02 | merge layer + tests ready (context.test.ts) |

## Hosted verification, 2 Nov 2026 (main fda93de + CORE fixes)

- Production 2.7.0 deployed from main (includes EXPERIENCE PR #9). Judges' clean site loads Mission Control with the "Sample Jira data" panel.
- Rovo agent "ANTICIPATE Decision Reviewer" answered in Rovo chat on the dev site with grounded, tool-backed output.
- Sample data flow on dev, project MP (company-managed software): preview (read-only) -> confirm -> 6 labelled issues MP-5..MP-10 and 4 Blocks links created and re-read from Jira (MP-5 blocks MP-6, MP-7, MP-9; MP-6 blocks MP-8). Re-preview shows every item EXISTS (idempotent). "Analyze MP-5" builds a CONFIRMED evidence graph.
- Bug found and fixed: on a service-desk project (HAM) the preview promised creation but every write was rejected. Issue types now come from createmeta (types the user can actually create), so such projects are refused up front. Jira 400 details are now logged.
- Known UI issue for EXPERIENCE: the create call can exceed the frontend timeout (TIMEOUT shown although all writes succeeded). Re-preview recovers correctly.

## Jira workflow validator, verified hosted (2 Nov 2026)

- Isolated company-managed project AVT ("ANTICIPATE Validator Test") on the dev site, with its own workflow "Software Simplified Workflow for Project AVT" (used by 1 space only). No existing workflow touched.
- Validator "ANTICIPATE Decision Firewall" added to the transition into "En cours" and published.
- AVT-1 (label anticipate-change, no decision): transition refused by Jira, HTTP 400: "ANTICIPATE Decision Firewall: AVT-1 cannot move forward because no ANTICIPATE decision has been recorded..." Status stays Backlog.
- AVT-2 (no label): transition accepted (HTTP 204), status En cours.
- The COMPLETED-decision pass path is covered by unit tests (validator.test).

## Dependency upgrade use case (2 Nov 2026)

- New engine operation UPGRADE_NODE (breaking or compatible). Scenarios: A breaking upgrade now, B backward-compatible shim, C migrate consumers first then upgrade. New read-only action and MCP tool `anticipate-simulate-upgrade`, wired to the Rovo agent.
- Unit tests: breaking upgrade reaches the same consumers as removal but triggers no removal-only rules; compatible upgrade has zero impact.
- Hosted (dev 4.19.0), Rovo chat with the ANTICIPATE Decision Reviewer: "breaking upgrade of MP-5, MP-9 as new version" returned A NEEDS_REVIEW (3 impacted, 2 direct, rule P3), B PASS (0 impacted).
