# 5-minute judge walkthrough

A timed path through ANTICIPATE on a fresh Jira site: **2 minutes for the core decision, 3 minutes of extras.** Every step names what you should see and points to an existing capture.

**About the captures.** Files named `MOCK_TRANSPORT` and those under `evidence/experience/v3-redesign/visual/` are captures of the real UI with a mock backend, labelled on screen. Files named `LIVE_FORGE` come from the hosted app. Hosted results with date and site are in [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md). The same core path passed in production on a clean site on 3 Nov 2026 (section "Clean-site judge run").

## Before you start (not timed)

- A Jira Cloud site **with Jira software projects** (a free site works) and a **company-managed software project** you can edit. Sites with only Jira Service Management cannot host the demo.
- Install with the link in [INSTALL_LINK.md](../submission/INSTALL_LINK.md), then open **Jira → Apps → ANTICIPATE**. The first open can take about 10 seconds.

## Core path (2 minutes)

| Time | Do | You should see | Capture |
| --- | --- | --- | --- |
| 0:00 | Click **Start the guided demo** and pick your project | Mission Control with the demo steps. Status badge "Connected · live mode" | `evidence/experience/v3-redesign/visual/01-mission-control-first-run-desktop-dark.png` |
| 0:15 | **Preview sample data**, then confirm **Create sample data** | First a read-only list of 6 issues and 4 links "Will be created"; after about 15–20 s the first time, "Created · verified in Jira" | `evidence/experience/v3-redesign/visual/31-sample-result-MOCK-390.png` |
| 0:40 | **Analyze** the sample root (snapshot) | Evidence Graph: the root, 2 direct consumers and 1 indirect consumer, each relation Confirmed, Inferred or Unknown with its Jira source | `evidence/experience/v3-redesign/visual/02-evidence-graph-desktop-dark.png` |
| 1:00 | **Compare options** | Scenario Lab: Remove now (Blocked), Retain temporarily (Needs review), Migrate first (Pass, labelled as a simulation assumption) | `evidence/experience/v3-redesign/visual/03-scenario-lab-desktop-dark.png` |
| 1:20 | **Check safeguards**, then **Generate prevention plan** | Decision Firewall with the reason chain; the plan lists concrete Jira actions | `evidence/experience/v3-redesign/visual/05-decision-firewall-blocked-desktop-dark.png`, `evidence/experience/v3-redesign/visual/07-prevention-plan-review-desktop-dark.png` |
| 1:35 | Select **all** actions → **Approve** → confirm | Approval dialog naming the exact actions; status "Approved · not executed" | `evidence/experience/v3-redesign/visual/08-approval-confirmation-desktop-dark.png` |
| 1:45 | **Execute** → confirm | Separate execution dialog; each action becomes "Verified" after Jira is read back | `evidence/experience/v3-redesign/visual/09-execution-confirmation-desktop-dark.png` |
| 2:00 | Open **Prevention Passport** | "In short" summary (option, verified actions, Jira transition status, open questions), then evidence, alternatives, approvals and timeline | `evidence/experience/v3-redesign/visual/11-prevention-passport-desktop-dark.png` |

## Extras (3 minutes)

| Time | Do | You should see | Capture |
| --- | --- | --- | --- |
| 2:00 | Passport → **Print or save as PDF** | A clean A4 report on a light paper palette | `evidence/core/passport-MOBL-58-LIVE_FORGE-dev-2026-11-03.pdf` (hosted) |
| 2:40 | Scenario Lab → **What if it slips?** → enter 10 days → **Simulate slip** | After the sample due-date change is deployed, newly created sample issues have dates at +7, +14 or +21 days from their UTC creation day: a 10-day root slip moves checkout, mobile and webhooks dates with their paths. No fix versions are created, so no late release is expected. Older sample issues are reused unchanged and may still show "Nothing to move" or "Cannot be assessed" when their Jira dates are missing. Preview lists the dates before creation; confirm the deployed behaviour with Muse | `docs/submission/gallery/03-slip-propagation.png` (diagram of the engine test data, not hosted proof of sample dates) |
| 3:20 | Scenario Lab → **Upgrade a dependency** | Breaking upgrade / compatible shim / move consumers first | `evidence/experience/v4-ux/scenario-lab-upgrade-light-1440-MOCK_TRANSPORT.png` |
| 3:50 | **Settings** | Capability table (in this app / backend reports / verified here), validator outage policy, Rovo and MCP guide | `evidence/experience/v3-redesign/visual/12-settings-desktop-dark.png`, `evidence/experience/v4-ux/settings-validator-policy-non-admin-LIVE_FORGE-dev.png` (hosted, non-admin view) |
| 4:20 | Optional, needs a Jira admin: add the "ANTICIPATE Decision Firewall" validator to a workflow transition (steps in [INSTALL_LINK.md](../submission/INSTALL_LINK.md)) and move the labelled sample root | Refused while the plan only assumes a migration; allowed after a real, verified decision | No capture. Hosted run in EVIDENCE_PACK, "Workflow validator on the clean judge site" |

## If something differs

- **No project listed:** the app says which permissions are needed (browse, create and link issues).
- **The sample creation takes longer:** the app re-reads Jira instead of retrying, and nothing is created twice.
- **"Plans are private to the user who created them":** each person runs their own plan. A colleague's plan cannot be opened.
- Admin-only features (validator, outage policy switch, MCP for external clients) are described in [docs/admin/WORKFLOW_VALIDATOR.md](../admin/WORKFLOW_VALIDATOR.md) and [INSTALL_LINK.md](../submission/INSTALL_LINK.md).
