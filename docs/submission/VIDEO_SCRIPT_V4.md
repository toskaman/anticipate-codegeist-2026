# Demo video — script V4 (jury-wow remake, 10 Nov 2026)

Status: SCRIPT READY — capture sitting + voice takes pending (owner, one sitting).
Target: **2:55** (hard ceiling 3:30; Devpost limit 5:00). English narration,
English subtitles. Licensed music track `vol12.mp3` + sfx set may be reused
(see `LICENSES.md`); no third-party logos other than Atlassian product UI shown
as used. Corner tags OBSERVED IN JIRA / SIMULATION / EXECUTED + VERIFIED kept
from V3 (honesty system, jury differentiator).

Record on **production 4.6.0** (`toskaman5962`, ADM sample project) unless a
scene says otherwise. The signature moment (pair button + hero verdict) exists
only in ≥4.6.0 (4.3.0–4.5.0 served a stale frontend without the wow) — V3 footage must NOT be reused for scene 3. Every result shown
must be observed on recording day; nothing from MOCK_TRANSPORT captures.
Publication needs the owner's agreement. The V3 film stays archived as the
fallback until V4 passes QA.

## V4 narrative (verbatim narration, ~415 words)

### S1 0:00–0:12 — Hook (OBSERVED IN JIRA)

Shot: Jira ADM-1 "Legacy Auth API v1" and its links; push-in on ADM-4 two
links away. Split cards: Change 1 "move consumers to API v2", Change 2
"breaking upgrade of v2".

> "Two changes. Each one looks safe in its own ticket. One moves consumers to
> API version two. The other ships a breaking upgrade of version two. Nobody
> reviews them together — until production does."

### S2 0:12–0:30 — Evidence in seconds (OBSERVED IN JIRA)

Shot: Apps → ANTICIPATE cold open ("Connected · live mode") → Mission Control
→ Analyze ADM-1 → Evidence Graph; ADM-4 path + Jira source visible.

> "ANTICIPATE reads the Jira links you can access and builds an evidence graph
> in seconds. Two consumers use the API directly. A third hides two links
> away. Every relation keeps its Jira source — and anything unreadable stays
> unknown, never safe."

### S3 0:30–1:00 — Climax: the collision (SIMULATION)

Shot: portfolio draft with the lone migration → **"Complete the collision
pair" click** → Simulate → **hero verdict hold 4 s**
("goes from Pass alone to Blocked together") → scroll conflicts + emergent
impacts naming ADM-2/3/4.

> "Now watch the moment that matters. One migration, drafted. One click
> completes the collision pair. Simulated together — they collide. Alone, the
> migration passes. Together, it is blocked: the consumers land on an API that
> is about to break. Records impacted only when the changes run together. No
> dashboard shows you this. ANTICIPATE proves it."

### S4 1:00–1:20 — The safer path (SIMULATION)

Shot: Composer alternatives; #1 Compatibility phase (0 conflicts, assumption
shown); #2 As proposed (2 conflicts). Open the reason chain.

> "So what ships instead? The Composer re-simulates bounded alternatives on
> the same evidence. A compatibility phase removes the collision — zero
> conflicts — and it states its assumption instead of hiding it. Splitting the
> work alone fixes nothing."

### S5 1:20–1:40 — Release surface (OBSERVED IN JIRA)

Shot: Release Safety → releases needing attention → click a release →
per-change states, Jira links, "What this check cannot know".

> "Release managers see which releases need attention, which change is
> blocked, and what is still unknown — inside the Jira workflow their teams
> already use. Not a report. A decision surface."

### S6 1:40–2:05 — Stale approvals cannot act (OBSERVED IN JIRA)

Shot: plan approved → Jira link added → Re-check CHANGED → Time Machine
"Added: ADM-1 depends on ADM-6" → execution refused, 0 writes.

> "Approved yesterday, blocked today. The evidence moved — a new relation
> appeared in Jira — so the old approval can no longer act. The Time Machine
> shows exactly what changed. Execution is refused, with zero writes.
> Yesterday's approval can never become tomorrow's incident."

### S7 2:05–2:25 — Jira-native enforcement (EXECUTED + VERIFIED)

Shot: Jira transition refused with the ANTICIPATE message → real migration →
verified execution (read-back) → Passport "In short".

> "Jira enforces it too. Move the ticket, and the transition is refused: the
> decision assumed work Jira does not show. Real migration, verified by
> reading Jira back — the gate opens. And the Passport records what was known,
> who approved, and what was verified."

### S8 2:25–2:45 — Agents on the same engine (OBSERVED IN JIRA)

Shot: MCP client Q&A citing Jira records (label "dev site" if recorded there)
+ Rovo answer. Seven tools list flash.

> "The same engine answers from any MCP client and from Rovo. Seven read-only
> tools, your own Jira permissions. Agents explain. People decide. Nothing
> approves or executes without a human."

### S9 2:45–3:00 — Close

Shot: closing card (team-made) + provenance line (prod 4.6.0, source commit,
date — filled at render).

> "Most tools show you what changed. ANTICIPATE helps you decide what should
> change — and proves it. Test the consequences. Prove the safeguards. Then
> ship."

## Shot list (capture order, prod 4.6.0 unless noted)

1. Jira ADM-1 issue view + links; ADM-4 two links away (hook B-roll).
2. Apps → ANTICIPATE cold open, "Connected · live mode".
3. Mission Control → Analyze ADM-1 → Evidence Graph, ADM-4 path + source.
4. Portfolio: draft migration ADM-1 → ADM-5 → pair-button click → Simulate →
   hero hold 4 s → conflicts/emergent scroll (THE signature take, re-shoot
   until flawless).
5. Composer: alternatives + select #1 + assumption close-up.
6. Release Safety: attention list → release → states → unknowns.
7. Approve → Jira link added → Re-check CHANGED → Time Machine diff →
   refusal (0 writes).
8. Transition refused banner → verified execution → Passport "In short".
9. MCP client Q&A + Rovo answer (dev site acceptable, labeled on screen).
10. Settings: capabilities + Build Information close-up (commit + timestamp).
11. Title + closing cards (team-made, no capture needed).

Capture specs: 1920×1080, browser zoom 125 %, dark theme, notifications off,
bookmarks bar hidden, mouse slow, no personal data or tokens in any frame.
Dataset: ADM reset per V3 (link #10004 procedure); restore the sample state
after the sitting so judges start clean.

## Voice recording guide (human VO, ~15 min)

Quiet room, phone mic held close is fine, WAV/MP3 44.1 kHz+. Record one take
per scene (S1–S9), natural pace, brief pause at sentence ends. Clap once
before each take for sync. Timing targets: S1 12 s, S2 18 s, S3 30 s, S4
20 s, S5 20 s, S6 25 s, S7 20 s, S8 20 s, S9 15 s. Two takes of S3 (the
climax). Fallback if recording is impossible: TTS via the pipeline (say "TTS"
and the film is built with generated voice instead — quality will be a notch
below human).

## Assembly + QA + publish (agent, after the sitting)

1. Ingest footage + VO; build the Hyperframes composition (captions variant
   on/off); `check` gate 0 errors.
2. Render Final + Clean; 2-pass loudnorm + true-peak limit; verify measured
   LUFS/dBTP; spot-frame QA vs storyboard; blackdetect; SRT fit check.
3. Package: Final/Clean mp4, EN.srt/vtt, thumbnail, title, description,
   evidence manifest; supersede (never delete) the V3 masters.
4. Docs: VIDEO_QA_REPORT addendum + parity refresh; record the public URL in
   #189 after owner upload. Publish public (listed) YouTube; owner pastes to
   Devpost.
