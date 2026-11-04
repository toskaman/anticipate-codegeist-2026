# Devpost submission checklist (field by field)

Purpose: the owner fills the Devpost form by copy-paste, and every mandatory rule item has a source. Rules source: `docs/research/VERIFIED_RULES_AND_APIS.md` (rules read 2 Nov 2026) and `docs/compliance/CODEGEIST_COMPLIANCE.md`. Deadline: **22 Dec 2026, 12:00 PT (21:00 Paris)**. Counts measured on `docs/submission/DEVPOST_FINAL.md` (words / characters, body only); re-measured 3 Nov 2026 on `main` 0df1874 (ORP-24).

Status: **ready** (copy as is) · **needs owner** (a person must act or decide) · **missing** (does not exist yet).

## Form fields

| # | Devpost field / rule item | Source (file → section) | Size | Status |
|---|---|---|---|---|
| 1 | Project name | DEVPOST_FINAL → header "Project name" | 53 chars | ready |
| 2 | Tagline / elevator pitch | DEVPOST_FINAL → header "Tagline" | 55 chars | ready |
| 3 | Inspiration | DEVPOST_FINAL → Inspiration | 72 w / 404 c | ready |
| 4 | What it does | DEVPOST_FINAL → What it does | 465 w / 2,987 c | ready |
| 5 | How we built it (includes how it meets the Forge + Atlassian product requirement) | DEVPOST_FINAL → How we built it | 240 w / 1,633 c | ready |
| 6 | Challenges we ran into | DEVPOST_FINAL → Challenges | 117 w / 713 c | ready |
| 7 | Accomplishments | DEVPOST_FINAL → Accomplishments | 137 w / 847 c | ready |
| 8 | What we learned | DEVPOST_FINAL → What we learned | 44 w / 246 c | ready |
| 9 | What's next | DEVPOST_FINAL → What's next | 43 w / 316 c | ready |
| 10 | Built with (tags) | Proposed from the code: `forge`, `jira`, `rovo`, `atlassian-mcp`, `react`, `typescript`, `node.js`, `zod`, `vite`, `playwright`, `vitest` | 11 tags | needs owner (pick tags in the form) |
| 11 | Category (one only) | DEVPOST_FINAL header: Apps for Software Teams | — | needs owner (select in the form) |
| 12 | Bonus prize and its write-up (one bonus can be won) | DEVPOST_FINAL → "Bonus write-up: Best app with Atlassian MCP"; decision D1 | 144 w / 884 c | ready (owner selects the bonus) |
| 13 | Install link (Atlassian sharing link) | `docs/submission/INSTALL_LINK.md` (first link, "Sharing with anyone") | — | ready; re-check it opens on the final build |
| 14 | Testing instructions (detailed, for judges) | DEVPOST_FINAL → Testing instructions (+ INSTALL_LINK prerequisites and validator/MCP steps) | 191 w / 1,322 c | ready |
| 15 | Demo video URL (public YouTube, under 5 min, app running, no unlicensed music or trademarks) | Script: `docs/submission/VIDEO_SCRIPT.md` (4:20) | — | **missing** (to record on the hosted judge site; risk K1) |
| 16 | Screenshots / image gallery | Diagram pack: `docs/submission/gallery/` (cover, architecture, slip propagation; PNG 1500×1000 + SVG, captions and sources in its README). Hosted app screenshots still needed: muse captures LIVE_FORGE screens (#64); repo MOCK_TRANSPORT images must stay labelled if used | 3 images | ready for diagrams; needs owner for live screenshots |
| 17 | Repository / "try it out" link | `README.md` (public repository) | — | ready (optional field) |
| 18 | Team members and eligible representative | `docs/compliance/CODEGEIST_COMPLIANCE.md` row "Team" | — | needs owner |
| 19 | English materials | All submission files are in English | — | ready |
| 20 | Built or updated after 27 Oct 2026, Forge app with ≥ 1 module | repository history; `manifest.yml` | — | ready |

## Mandatory rule items covered

| Rule item | Covered by | Status |
|---|---|---|
| Video < 5 min, public YouTube, shows the app running | row 15 | missing |
| Install link following Atlassian sharing instructions | row 13 | ready |
| Setup / testing instructions | row 14 | ready |
| Text description | rows 3–9 | ready |
| Explanation of the technology / requirement met | row 5 | ready |
| Category + bonus write-up | rows 11–12 | ready (selection by owner) |

## Cross-file consistency audit (3 Nov 2026, `main` d995021)

Fixed in `DEVPOST_FINAL.md` (supported by evidence or code):

| Where | Was | Now | Evidence |
|---|---|---|---|
| DEVPOST_FINAL "What it does" (Rovo/MCP bullet) and bonus write-up | five MCP tools | six tools, incl. simulate slip | `manifest.yml` `rovo:mcp` (6 tools) |
| DEVPOST_FINAL "What it does" | slip simulation absent | "See what a delay would do" bullet | EVIDENCE_PACK "What-if slip simulation, hosted on dev" (3 Nov, dev 6.2.0) |
| DEVPOST_FINAL "What's next" | listed date-slip simulation as future | removed (it exists) | same |
| DEVPOST_FINAL "How we built it" | 90 backend / 62 frontend unit tests | 93 / 69 (16 engine unchanged) | local run on `main` d995021 |
| DEVPOST_FINAL Testing instructions step 4 | "approve the actions" | "approve **all** the actions (a partial approval ends as Partial)" | INSTALL_LINK.md:15; partial-approval rule (CORE P0 fix) |

For muse (files outside this task's ownership; proposed values):

| File:line | Says | Other file says | Proposed |
|---|---|---|---|
| `docs/submission/VIDEO_SCRIPT.md:38` | "Five read-only tools" | manifest: 7 MCP tools | fixed 4 Nov: "Seven read-only tools" (guarded by test/mcp-tool-count.test.ts) |
| `README.md:78` | 68 frontend unit tests on 41e5d2a | 69 on d995021 | refresh counts on the final build (one place: README, DEVPOST_FINAL) |
| `docs/submission/INSTALL_LINK.md:14` | sample creation "about 15 s"; "tickets" | README.md:26 and DEVPOST_FINAL:75: "about 15–20 s"; "issues" | "about 15–20 s the first time"; "issues" |
| `manifest.yml:11` (validator description shown to Jira admins) | "until their latest ANTICIPATE prevention plan is COMPLETED (verified)" | README/DEVPOST: also needs live Jira links to agree (R17) | add "and live Jira links agree" |
| `docs/submission/DEVPOST_DRAFT.md:29` | "100 % precision/recall vs an independent oracle on 200 annotated graphs" (not marked synthetic) | DEVPOST_FINAL: synthetic benchmark, not field accuracy | mark DEVPOST_DRAFT as superseded by DEVPOST_FINAL |

Checked and consistent: product name and tagline; category; MCP-only bonus and Teamwork Graph status (ECOHELP-180616); sample data = 6 issues + 4 links; first open "about 10 seconds" everywhere (production not re-measured after 6.3.0, so keep this wording until muse records a production value); 6/6 verified writes; "Prevention Passport" naming.
