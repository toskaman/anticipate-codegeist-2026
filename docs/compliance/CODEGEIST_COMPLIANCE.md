# Codegeist 2026 compliance matrix

Source: https://codegeist2026.devpost.com/rules (read 3 Nov 2026). Deadline: **22 Dec 2026, 12:00 Pacific Time (21:00 Paris)**. Status values: PASS / FAIL / BLOCKED / NOT VERIFIED / NOT APPLICABLE.

| Requirement | Mandatory | Status | Evidence | Remediation / owner |
|---|---|---|---|---|
| Runs on Forge, integrates Jira/Confluence/JSM/Bitbucket/TWG/Rovo | yes | PASS | manifest.yml (Jira, Rovo agent, rovo:mcp, workflow validator) | — |
| Installable by judges via an install link ("start sharing your app") | yes | PASS | docs/submission/INSTALL_LINK.md; clean-site install 3 Nov (EVIDENCE_PACK) | — |
| Runs consistently and as described | yes | PASS (current build) | clean-site journey + validator, 3 Nov | re-run on final SHA (muse) |
| Demo video < 5 min, YouTube public, shows the app running | yes | FAIL (not produced) | — | owner + orpheane; script by muse |
| No third-party trademarks or copyrighted music in video | yes | NOT VERIFIED | — | check at video review |
| Judge instructions (config, integrations) | yes | PASS | INSTALL_LINK.md (install, Free plan notes, validator steps) | keep in sync with final build |
| Text description incl. how it meets the tech requirement | yes | NOT VERIFIED (final text ready, form not filled) | docs/submission/DEVPOST_FINAL.md, TECHNICAL_SECTION.md | owner pastes at submission; re-read against final build |
| Category selected (Apps for Software Teams) | yes | NOT VERIFIED (form not submitted) | DEVPOST_FINAL.md header | owner submits |
| Bonus write-up per bonus selected | yes if bonus | NOT VERIFIED (write-up ready, form not filled) | MCP write-up in DEVPOST_FINAL.md | final review at submission |
| English materials | yes | PASS | repository and drafts in English | — |
| New or rebuilt in Forge during the period | yes | PASS | repository history from Nov 2026 | — |
| Original, owned by entrants; third-party licenses respected | yes | PASS (to re-check before submit) | LICENSE (50/50), THIRD_PARTY_NOTICES in build | licence scan in CI (muse, P1) |
| Team: one eligible Representative | yes | NOT VERIFIED | — | owner confirms eligibility (not a restricted jurisdiction) |
| Repository public / license | not required | NOT APPLICABLE | repo is public, proprietary source-available | — |
| Marketplace listing | only for that bonus | NOT APPLICABLE | not claimed | — |
| One bonus maximum | rule | PASS | `.github/agent-coordination/decisions.md` D1 (MCP) | — |
| No changes after the deadline | rule | NOT APPLICABLE yet | — | freeze release before 22 Dec |

Verdict today: **NO-GO for submission** (video and Devpost form missing). Product build: GO for the demo scenario.
