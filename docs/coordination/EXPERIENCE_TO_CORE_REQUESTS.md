# EXPERIENCE → CORE: open requests

Read this file first. Newest request at the top. When a request is done, change its state and answer in `CORE_TO_EXPERIENCE_HANDOFF.md`.

## R-38 (3 Nov 2026): three contracts and one doc. State: OPEN
1. **`docs/submission/TECHNICAL_SECTION.md` is out of date.** It still says three MCP tools, 16 backend tests, "not yet as a Jira workflow validator". Please update it from `docs/STATUS.md`: five tools, 74 backend tests, the validator with outage policy, R17 and `gate`, upgrade scenarios. EXPERIENCE keeps the overall Devpost wording consistent.
2. **Teamwork Graph provenance (when the adapter is wired).** The UI already reads `GraphSnapshot.coverage`. Before EXPERIENCE shows Teamwork Graph relations, please confirm the fields per edge or per source: source (`JIRA` / `TEAMWORK_GRAPH`), whether a relation is verified or only documentary, whether it feeds the simulation, and a source state (`LIVE` / `PARTIAL` / `UNAVAILABLE` / `NOT_CONFIGURED`, plus "needs admin" if any). The design proposal is in `docs/design/ENTERPRISE_AND_TWG_UX.md` §2. Nothing will be shown as live until the backend reports it.
3. **Enterprise workspace.** `docs/design/ENTERPRISE_AND_TWG_UX.md` §1 proposes the screens for your `ENTERPRISE_WORKSPACE.md` design. EXPERIENCE needs a contract before building: who can approve (with the reason when not), the step waiting on a person, approval expiry and Passport visibility. Nothing multi-user will be shown before the backend enforces it.
4. Not needed now: the rest is display only.

## R-37 (3 Nov 2026): PR #37 hosted acceptance. State: MERGED (0e37a1e), DEPLOYED (dev v4.37.0, prod v2.25.0); acceptance mostly PASS

PR #37 is merged; no merge request remains. Dev already runs it: the Settings panel appeared on dev for a non-admin on 3 Nov.

What is still needed (checklist and results table: `docs/jury/HOSTED_ACCEPTANCE_PR37.md`):
1. ~~Production deployment~~ done (v2.25.0, STATUS.md). ~~Admin Allow → Block → Allow persisted~~ done. ~~MOBL-58 gate CLOSED~~ done.
2. Still open: Cancel in the confirmation saves nothing (A4); after the next frontend deploy, the Passport "In short" box on MOBL-58 and one print (P1, P5).
3. R18 (unreadable issue follows the outage policy) is yours to check after its deploy; no UI change needed.
4. Optional: call `setValidatorPolicy` as a non-admin and check `PERMISSION_DENIED`. A frontend that hides the switch is not server security.
5. Any visual defect: describe it in the handoff file. EXPERIENCE fixes `static/hello-world`.

Done: Settings as non-admin on dev, PASS (3 Nov, Orphee, invited account, capture `evidence/experience/v4-ux/settings-validator-policy-non-admin-LIVE_FORGE-dev.png`).
