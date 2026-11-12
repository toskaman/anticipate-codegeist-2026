# Devpost submission checklist (field by field)

Purpose: the owner fills the Devpost form by copy-paste, and every mandatory rule item has a source. Rules source: `docs/research/VERIFIED_RULES_AND_APIS.md` (rules read 2 Nov 2026) and `docs/compliance/CODEGEIST_COMPLIANCE.md`. Deadline: **22 Dec 2026, 12:00 PT (21:00 Paris)**. Counts measured on `docs/submission/DEVPOST_FINAL.md` (words = whitespace-separated tokens, characters = trimmed body incl. markdown); re-measured 12 Nov 2026 on the freeze branch (main c378163); re-measured again on the TITAN wave-1 branch (main ecc9379).

Status: **ready** (copy as is) · **needs owner** (a person must act or decide) · **missing** (does not exist yet).

## Form fields

| # | Devpost field / rule item | Source (file → section) | Size | Status |
|---|---|---|---|---|
| 1 | Project name | DEVPOST_FINAL → header "Project name" | 53 chars | ready |
| 2 | Tagline / elevator pitch | DEVPOST_FINAL → header "Tagline" | 55 chars | ready |
| 3 | Inspiration | DEVPOST_FINAL → Inspiration | 72 w / 406 c | ready |
| 4 | What it does | DEVPOST_FINAL → What it does | 702 w / 4,614 c | ready |
| 5 | How we built it (includes how it meets the Forge + Atlassian product requirement) | DEVPOST_FINAL → How we built it | 289 w / 1,957 c | ready |
| 6 | Challenges we ran into | DEVPOST_FINAL → Challenges | 118 w / 726 c | ready |
| 7 | Accomplishments | DEVPOST_FINAL → Accomplishments | 137 w / 852 c | ready |
| 8 | What we learned | DEVPOST_FINAL → What we learned | 44 w / 246 c | ready |
| 9 | What's next | DEVPOST_FINAL → What's next | 43 w / 318 c | ready |
| 10 | Built with (tags) | Proposed from the code: `forge`, `jira`, `rovo`, `atlassian-mcp`, `react`, `typescript`, `node.js`, `zod`, `vite`, `playwright`, `vitest` | 11 tags | needs owner (pick tags in the form) |
| 11 | Category (one only) | DEVPOST_FINAL header: Apps for Software Teams | — | needs owner (select in the form) |
| 12 | Bonus prize and its write-up (one bonus can be won) | DEVPOST_FINAL → "Bonus write-up: Best app with Atlassian MCP"; decision D1 | 161 w / 1,013 c | ready (owner selects the bonus; optional 2nd-bonus draft: BONUS_AGENTS_DRAFT.md — entering 2 allowed, winning 1 max) |
| 13 | Install link (Atlassian sharing link) | `docs/submission/INSTALL_LINK.md` (first link, "Sharing with anyone") | — | ready (prod 4.6.0 serving; consent page verified 8 Nov on byte-identical manifest; re-check at submit) |
| 14 | Testing instructions (detailed, for judges) | DEVPOST_FINAL → Testing instructions (+ INSTALL_LINK prerequisites and validator/MCP steps) | 208 w / 1,457 c | ready |
| 15 | Demo video URL (public YouTube, under 5 min, app running, no unlicensed music or trademarks) | V10 Titan master 2:48 QA ACCEPTED 10 Nov (`docs/evidence/VIDEO_QA_REPORT.md`; prod 4.6.0 footage); V4 script `docs/submission/VIDEO_SCRIPT_V4.md` | — | **needs owner** (voice spot-check, co-owner approval, public upload, paste URL; #189) |
| 16 | Screenshots / image gallery | Diagram pack: `docs/submission/gallery/` (cover, architecture, slip propagation; PNG 1500×1000 + SVG, captions and sources in its README). Hosted dev screenshots 8 Nov: `docs/evidence/hosted-2026-11-08/` (5 LIVE_FORGE_DEV captures); repo MOCK_TRANSPORT images must stay labelled if used | 3 diagrams + film posters + 5 hosted | ready for diagrams + dev captures; judge-site captures pending (#191) |
| 17 | Repository / "try it out" link | `README.md` (public repository) | — | ready (optional field) |
| 18 | Team members and eligible representative | `docs/compliance/CODEGEIST_COMPLIANCE.md` row "Team" | — | needs owner |
| 19 | English materials | All submission files are in English | — | ready |
| 20 | Built or updated after 27 Oct 2026, Forge app with ≥ 1 module | repository history; `manifest.yml` | — | ready |

## Mandatory rule items covered

| Rule item | Covered by | Status |
|---|---|---|
| Video < 5 min, public YouTube, shows the app running | row 15 | cut ready + QA accepted; public upload needs owner |
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

## 12 Nov 2026 refresh (freeze)

- Sizes re-measured on the freeze branch (words = whitespace-separated tokens, chars = trimmed body incl. markdown); "What it does" grew with shipped features (portfolio, Composer, Release Safety, Time Machine).
- DEVPOST_FINAL test counts refreshed to main c378163 (336/75/13/225/200); evidence row points at RELEASE.md + main run 43224602099.
- Shipping build is prod 4.6.0 (main 49e1f40, code = b1e4677; redeploys 10 Nov 12:47:41–12:52:55Z, vars 12:48:19Z): RELEASE.md, PROD_RELEASE_CANDIDATE.md, INSTALL_LINK.md and VIDEO_SHIPPING_PARITY.md updated.
- Video row now points at the V10 Titan master (2:48, QA ACCEPTED 10 Nov, prod 4.6.0 footage) + VIDEO_SCRIPT_V4.md; upload still owner (#189).
- Remaining owner actions unchanged: public video URL, Devpost form fill, #191 judge rerun, #190 MCP 7/7, team eligibility.

## 12 Nov 2026 TITAN wave-1 fixes

- DEVPOST_FINAL: MCP tools named + 5/7 external qualifier, Playwright browser wording tightened, single-creator disclosure, "minutes" fix, Rovo starter tip. Sizes re-measured above.
- INSTALL_LINK: company-managed how-to, Schedule Issues/Due-date prerequisites, 3 blocks + 1 relates accuracy, EN/FR transition names, sample cleanup note.
- JUDGE_RERUN: slip step 13 (fixVersion tip), EN/FR transition names.
- VERIFIED_RULES: fixed wrong "(3 min watched)" — rule says judges may stop at 5:00.
- New: BONUS_AGENTS_DRAFT.md (optional 2nd bonus; entering 2 allowed, winning 1 max; recommendation stays MCP).
- Film P0 (overlays contradicting honesty rules) filed on #189 for the owner; video untouched by this branch.
