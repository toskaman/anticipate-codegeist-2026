# Three-minute demonstration plan

No video has been recorded or submitted. Only film capabilities verified on the hosted site on recording day. Local captures are MOCK_TRANSPORT and must keep that label; never present them as hosted Jira execution.

## Setup (before recording)

- Hosted dev or prod site with the latest deployed EXPERIENCE build (CORE deploys). Confirm the "Connected · live mode" badge.
- A Jira project you may write to. Prepare sample data in advance (guided demo) or film it live: first-time creation takes about 15–20 s.
- Browser window 1440×900, zoom 100 %, Light theme via Display & accessibility (best contrast on video). Hide bookmarks bar and notifications.
- Rovo scene only if the Decision Reviewer is enabled on that site and answered in a dry run.

## Scenes

| Time | Screen | Action | Caption (on screen) |
| --- | --- | --- | --- |
| 0:00–0:20 | Mission Control | Show the hero and "Try the guided demo" | "Retiring or upgrading something in Jira? See what breaks before you change it." |
| 0:20–0:40 | Mission Control → Evidence Graph | Choose project + sample root, Analyze | "Dependencies read from real Jira links, with their source." |
| 0:40–1:05 | Evidence Graph | Select the inferred and unknown records; open a source link | "Confirmed, inferred and unknown are never mixed up." |
| 1:05–1:30 | Scenario Lab | Compare remove / retain / migrate (or Upgrade a dependency if the site advertises it) | "Same evidence, three possible changes, deterministic results." |
| 1:30–1:55 | Decision Firewall | Open the blocked option: reason chain + remaining uncertainty | "Policy blocks the unsafe option and says exactly why." |
| 1:55–2:15 | Prevention Plan | Select actions → Approve → separately Execute → statuses read back | "Approval and execution are two human steps. Results are verified by reading Jira back." |
| 2:15–2:35 | Prevention Plan | Only if prepared: change a Jira link, show EVIDENCE_CHANGED refusal | "Evidence changed, so the old approval no longer counts." |
| 2:35–2:50 | Prevention Passport | Scroll the record, export JSON/print | "A verified decision record, not a compliance certificate." |
| 2:50–3:00 | Rovo Chat (optional) / Settings | Ask the Decision Reviewer about the same issue, or show the Rovo panel | "Read-only in Rovo. People stay accountable for every write." |

## Checklist

- [ ] Every scene re-run once on the hosted site the same day.
- [ ] No fabricated metrics, logos, testimonials or savings.
- [ ] Execution scene performed only with explicit authorization for those exact Jira actions; otherwise show approval and stop.
- [ ] Captions match what is on screen; no "AI decides" wording.
- [ ] Video under three minutes; English.

Still capture candidates (MOCK_TRANSPORT, for review only): `evidence/experience/v3-redesign/visual/` 01–12 and `evidence/experience/v4-ux/`.
