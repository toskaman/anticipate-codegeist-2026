# Demo video — script and shot list

Preparation update (4 November 2026): [DRIFT_CAPTURE_PLAN.md](DRIFT_CAPTURE_PLAN.md) proposes a 4:30 English narration/caption storyboard with stale-decision refusal before 3:00. It supersedes the timing proposal below when that hosted proof is available; retain this file's validator setup and dataset reset instructions. Neither plan is recorded evidence. Final recording and publication remain deferred.

Target: **4:20** (limit 4:45; Devpost limit 5:00). The core journey, including the Jira gate, ends by **2:55**. English narration and English subtitles. No music, or only music the team made or holds a licence for; no third-party logos other than Atlassian product UI shown as used.

Record on the hosted judge site **anticipate-judge** (production install, project JDG) unless a scene says otherwise. Every result shown must be observed on recording day; nothing from MOCK_TRANSPORT captures. Publication needs both owners' agreement.

## On-screen labels

A small corner tag tells viewers what kind of information they see:

| Tag | Meaning | Used for |
|---|---|---|
| **OBSERVED IN JIRA** | Read from the live Jira site | graph, sample data, Jira issue view, verified actions |
| **SIMULATION** | Computed on a frozen snapshot, nothing changed in Jira | Scenario Lab, Decision Firewall, "Migrate first" |
| **EXECUTED + VERIFIED** | Written to Jira after approval, then re-read | plan execution, validator outcome |

## Before recording

- Fresh JDG state: run **Preview sample data**. If it offers to recreate the two consumer links removed in the 3 Nov validator test, confirm so JDG-1 blocks JDG-2 and JDG-3 again.
- The "ANTICIPATE Decision Firewall" validator is on the JDG transition to "En cours" (EVIDENCE_PACK, 3 Nov). JDG-1 is labelled `anticipate-change` and in Backlog.
- 1920×1080 capture, browser zoom 125 %, dark theme, notifications off, bookmarks bar hidden.
- MCP scene: an MCP client connected to the app (dev site is acceptable; say so on screen).
- Note the build version from Settings → Performance or the release record; write it in the video description.

## Script

| Time | Shot | Narration | Subtitle / on-screen text | Tag |
|---|---|---|---|---|
| 0:00–0:12 | Jira issue JDG-1 "Legacy Auth API v1": its two "blocks" links. Slow push-in; then show JDG-2, which blocks JDG-4 "Partner webhooks". | "Retiring an old API looks safe in the ticket. But one of the services that breaks is two links away, on an issue nobody opened." | A small change. A hidden dependency. | OBSERVED IN JIRA |
| 0:12–0:24 | Jira → Apps → ANTICIPATE; Mission Control loads with "Connected · live mode". | "ANTICIPATE is a decision firewall for Jira. Before a team changes something, it shows what depends on it, compares safer options, and keeps people accountable." | Test the consequences. Prove the safeguards. Then ship. | — |
| 0:24–0:40 | Start the guided demo → project JDG → Preview sample data (all "Already in Jira · reused") → Analyze JDG-1. Cut any wait. | "The guided demo previews sample data before writing anything. Here it is already in Jira, so nothing is created twice." | Preview first. No hidden writes. | OBSERVED IN JIRA |
| 0:40–1:05 | Evidence Graph: JDG-1 in the centre; select Partner webhooks; the inspector shows the path through Checkout and the Jira link source. | "ANTICIPATE reads the links you can access. Two services use the API directly. A third is affected through Checkout. Every relation points to its Jira source, and anything unreadable stays unknown." | 2 direct consumers + 1 indirect. Nothing assumed safe. | OBSERVED IN JIRA |
| 1:05–1:28 | Scenario Lab: Remove now (Blocked), Retain temporarily (Needs review), Migrate first (Pass). Hold on "Simulation assumption: consumers have already moved". | "Instead of one answer, it simulates three decisions on the same evidence. Same input, same result, every time. Migrate first passes, but only as an assumption: comparing options migrates nothing." | Compare decisions, not tickets. | SIMULATION |
| 1:28–1:45 | Decision Firewall on Remove now: reason chain change → Checkout → policy. | "Removing now is blocked, and the reason is traced from the change to the service that still depends on it." | Blocked, with the reason. | SIMULATION |
| 1:45–2:08 | Back to Migrate first → Generate prevention plan → Approve dialog → Execute dialog → status Verified. | "Acting takes people. You approve specific Jira actions, then confirm execution as a separate step. Each result is verified by reading Jira back." | Two human steps. Verified in Jira. | EXECUTED + VERIFIED |
| 2:08–2:22 | Prevention Passport: "In short" box; the Jira transition row "Closed · the validator refuses it" with its reason. | "The Prevention Passport records what was known, what was compared, who approved and what was verified. The plan is complete, yet the Jira transition stays closed." | Done is not the same as allowed. | OBSERVED IN JIRA |
| 2:22–2:55 | Jira board: move JDG-1 to "En cours" → refused with the ANTICIPATE message. Then remove the two consumer links (the real migration), Analyze again, Remove now passes, approve and execute, move JDG-1 → accepted. Speed up the middle part 4×. | "Jira enforces it too. Moving the ticket is refused: the decision assumed a migration that Jira does not show. Once the consumers have really migrated, a new decision is verified and the transition goes through." | Assumed: refused. Real: allowed. | EXECUTED + VERIFIED |
| 2:55–3:20 | MCP client asking "What happens if we retire JDG-1?" → answer citing JDG records. Label "dev site" if recorded there. | "Teams can ask from any MCP client, or from Rovo. Six read-only tools use the same engine and the user's Jira permissions. They explain; they cannot approve or execute." | Same engine. Read-only. | OBSERVED IN JIRA |
| 3:20–3:40 | Settings: capability table, then the "Workflow validator during an outage" panel (admin view). | "Administrators see exactly what is enabled, and choose whether transitions pass or are blocked if ANTICIPATE is unavailable." | Honest capabilities. Admin-controlled. | — |
| 3:40–4:05 | Simple card: Forge · Jira as the user · deterministic engine · human approval · verified writes · tests in CI. | "It runs on Forge with Jira's own permissions, a deterministic engine, human approval at every write, and tests on every change." | Built on Forge. No invented probabilities. | — |
| 4:05–4:20 | Closing card with name and tagline. | "ANTICIPATE helps software teams change things safely, and prove it." | ANTICIPATE — The Decision Firewall for Software Teams | — |

## Shot list (capture order)

1. JDG-1 and JDG-2 issue views in Jira.
2. Mission Control load (cold open if possible, then trim).
3. Guided demo preview with "Already in Jira · reused".
4. Evidence Graph on JDG-1, Partner webhooks selected, inspector visible.
5. Scenario Lab with three options; close-up on the assumption line.
6. Decision Firewall on Remove now.
7. Plan for Migrate first: approve dialog, execute dialog, Verified.
8. Passport: "In short" and the Jira transition row.
9. Jira transition refused (error banner readable).
10. Link removal on JDG-1, re-analysis, new plan executed, transition accepted.
11. MCP client question and answer.
12. Settings: capabilities and outage policy.
13. Title and closing cards (team-made).

## After recording

- Restore JDG: move JDG-1 back to Backlog and recreate the consumer links with Preview sample data, so judges start from the same state.
- Keep raw captures and the editing project outside the repository (shared drive); put the YouTube link and build version in `docs/submission/`.
- Check subtitles against the narration, the length (≤ 4:45) and that no frame shows personal data or tokens.
