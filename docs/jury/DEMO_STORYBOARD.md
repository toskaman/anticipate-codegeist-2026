# Jury video — storyboard and shooting plan

No video has been recorded, published or submitted. Publishing needs both owners' explicit agreement. Film only the hosted app (LIVE_FORGE) and only capabilities verified on recording day. MOCK_TRANSPORT captures are for review and must never be presented as hosted Jira results.

Target: English, under 5 minutes, everything essential before 3:00. Subtitles in English. No music or footage without rights; a plain voice-over is fine.

## Setup

- **Site:** dev or prod with the latest deployed build; "Connected · live mode" badge visible.
- **Project:** a company-managed software project with sample data already created (or film creation in scene 3; it takes about 15–20 s the first time, so cut the wait).
- **Screen:** 1920×1080 recording, browser zoom 125 %, Dark theme (product default). Hide bookmarks, extensions and notifications. Close the Jira sidebar if it covers the app.
- **Optional scenes need proof first:** evidence-changed refusal (prepare a link change), Rovo agent (dry run answered), MCP client (admin toggle on), workflow validator (validator on a test workflow).

## Scenes

| Time | Screen and action | Narration (voice-over) | Subtitle / on-screen text | Evidence needed |
| --- | --- | --- | --- | --- |
| 0:00–0:15 | A Jira ticket "Retire Auth API v1", then cut to a dependency hidden two links away | "This change looks simple. The service it breaks is two links away, in an issue nobody opened." | A small change. A hidden dependency. | Real Jira issue from the sample project |
| 0:15–0:35 | ANTICIPATE Mission Control, guided demo | "ANTICIPATE is a decision firewall for Jira. Before you change something, it shows what depends on it, compares safer options, and keeps people accountable." | Test the consequences. Prove the safeguards. Then ship. | Hosted app open |
| 0:35–1:05 | Analyze the sample root → Evidence Graph; select an Inferred and an Unknown record, open the Jira source | "It reads the issues and links you can access. Every relation is confirmed, inferred or unknown, and points to its Jira source. Unknown stays unknown." | Real Jira evidence. Nothing assumed safe. | Live graph on the sample data |
| 1:05–1:40 | Scenario Lab: compare remove now / retain / migrate first; optionally switch to "Upgrade a dependency" | "Instead of one answer, it simulates alternatives on the same evidence: remove now, keep it for a while, or migrate consumers first. Same input, same result, every time." | Compare decisions, not tickets. | Live comparison |
| 1:40–2:05 | Decision Firewall on the blocked option: reason chain and remaining uncertainty | "Removing now is blocked: the services listed on screen still use the API. The reason is traced from the change to the dependency to the policy." | Blocked, with the reason. | Live verdict |
| 2:05–2:35 | Prevention Plan: select actions → Approve → separately Execute → statuses Verified | "Fixing it takes people. You approve specific Jira actions, then confirm execution separately. Each result is verified by reading Jira back." | Two human steps. Verified in Jira. | Execution authorized for these exact actions |
| 2:35–2:55 | Prevention Passport, scroll, then the printed PDF | "The Prevention Passport records what was known, what was compared, who approved and what actually happened." | An auditable decision record. | Live Passport + print from the same site |
| 2:55–3:20 | Rovo chat with the Decision Reviewer, same issue | "Teams can ask from Rovo too. The agent uses the same engine, read-only: it explains, people decide." | Read-only in Rovo. People stay accountable. | Rovo answer recorded that day |
| 3:20–3:45 | Optional: evidence-changed refusal, or the workflow validator blocking a transition | "If dependencies change after approval, the old decision no longer counts, and ANTICIPATE refuses to act." | Stale decisions are refused. | Prepared drift or validator test |
| 3:45–4:10 | Settings (capabilities truth table) + closing card | "Built on Forge, with Jira permissions, deterministic simulations and human approval. ANTICIPATE helps software teams change things safely." | ANTICIPATE — The Decision Firewall for Software Teams | — |

Teamwork Graph appears only if it is integrated and demonstrated before recording; otherwise do not mention it beyond "Jira evidence only".

Narration that names numbers or services must be adjusted to what the hosted screen shows on the day.

## Transitions and pacing

Cut on actions (click → next screen), no slide transitions. Zoom-in crops in editing for the graph and the reason chain. Keep each spoken sentence under 12 seconds so subtitles stay readable.

## Checklist

- [ ] Every scene shot on the hosted site the same day, with the build SHA noted.
- [ ] No fabricated metrics, logos, testimonials, savings or probabilities.
- [ ] Execution filmed only with explicit authorization for those exact Jira actions.
- [ ] Subtitles match the narration; no "AI decides" or "prevents every incident".
- [ ] Under 5 minutes; key story complete by 3:00.

Review stills (MOCK_TRANSPORT): `evidence/experience/v3-redesign/visual/` and `evidence/experience/v4-ux/`.
