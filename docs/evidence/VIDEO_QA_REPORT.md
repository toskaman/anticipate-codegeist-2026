# Video QA report — ANTICIPATE Codegeist 2026 film (T7-1)

Date: 8 Nov 2026. Reviewer: TITAN-7 session. Method: 17 extracted frames
(1.5–172 s) inspected visually + ffprobe/ebur128/blackdetect/silencedetect/
volumedetect instrumentation + script/SRT/description/license audit.
Full-motion viewing and voice listening were NOT possible in this session;
instrumental proxies were used instead (stated per item).

File: `brag-output/codegeist-2026/renders/ANTICIPATE_CODEGEIST_2026_FINAL.mp4`

## Verdict: ACCEPTED FOR OWNER PUBLICATION REVIEW (public-listed)

Two non-blocking notes (A: voice spot-check by ear; B: version-provenance
confirmation in T7-2). No re-render required.

## Technical (all VERIFIED by measurement)

- Duration 174.27 s (2:54), 1920x1080, 30 fps, H.264 High + AAC 48 kHz stereo.
- Loudness: integrated -14.5 LUFS, true peak -1.4 dBTP (YouTube-compatible).
- Mean volume -17.3 dB, max -1.4 dB; no silence >= 2 s at -40 dB (no dropouts).
- blackdetect: single 0–0.667 s fade-from-black lead-in (intentional
  editorial); no unintended black frames.
- Subtitles: 39 cues, last ends 2:43.77, text matches narration script;
  burned-in captions legible in every sampled frame.
- Narration ends 2:43.5; complete narrative before 3:00. CLEAN cut matches
  specs (2:54.10, same codecs) for SRT-based upload path.

## Editorial (all sampled frames VERIFIED genuine app UI)

- Real footage: Evidence Graph (6 records, 5 rel, 4 confirmed, 1 inferred,
  observed 07 Nov 21:46 CET), portfolio input, collision verdict
  (COMBINED: NEEDS REVIEW, AVT-4/5/6/8 impacted-only-together), per-side
  verdicts, Composer #1 (0 conflicts, assumption stated), Decision
  Firewall BLOCKED traced to AVT-4/5/8, Release Command Center
  (AVT-3 INVALIDATED, needs re-check), approve→execute separation,
  verified execution (1 of 1 read back, comment id 84906), approved-not-
  executed plan, evidence-changed refusal (AVT-1 DEPENDS_ON AVT-3 added),
  Time Machine checkpoint diff (20:55 UTC), Passport refusal
  (validator refuses transition). Timestamps internally consistent.
- Source traceability: `stills/collision.png` shows the same app state as
  the 0:45 film frame; 5 clips + 7 stills retained in `composition/assets/`.
- Honest in-app microcopy visible throughout (simulation disclaimers,
  TEAMWORK_GRAPH allowlisting-pending notice, "Not a legal attestation").
- Approval/execution distinction accurate; refusal beats genuine.
- No MCP claims in film (correct: external validation is 5/7).
  No customers, ROI, Teamwork Graph, Marketplace, or production claims.
- No secrets, emails, or non-sample PII in any sampled frame.
- Licenses: own footage; Kokoro-82M Apache-2.0 TTS; Sascha Ende CC BY 4.0
  music with attribution in YT description; Kenney CC0 SFX; system font;
  GSAP free. Third-party marks limited to nominative Atlassian/Jira/Forge.
- Thumbnail accurate (real app backdrop, states match film).

## Disclosed editorial splice (no action)

The approval motion (plan created 22:02 CET, run 2) and the
evidence-changed stills (plan created 21:53 CET, change 21:55 CET, run 1)
come from two runs with the same link on the same tickets. The evidence
manifest "Honest edits" section already discloses this. Narration
compresses both runs into one story beat (standard, disclosed).

## Fixes applied in this pass

- `YOUTUBE_DESCRIPTION.txt`: chapter line corrected (Time Machine appears
  in the 1:51 chapter; 2:19 is Passport + validator refusal).
- `EVIDENCE_MANIFEST.md`: retained-source path mapping added.

## Open notes

- A. Voice naturalness/word-stress NOT verified by listening (no audio
  playback in session). Owner: spot-check 0:00–0:30 and 2:35–2:44 by ear.
- B. RESOLVED (T7-2): Forge records confirm a successful owner deploy to
  the dev environment at 2026-11-07T20:34:50Z (21:34:50 CET), 9 min after
  #202 merged; second deploy to major 8, i.e. 8.1.0 by Forge
  minor-increment (minor string INFERRED-STRONG, not directly observed).
  Installed code = RC code (docs-only delta). End-card/description
  version line corroborated; no publish blocker on this point.

## Publication requirements (owner)

- Co-owner approval of final cut + public (listed) visibility.
- Upload CLEAN mp4 + EN.srt (or FINAL with burned captions); paste title,
  description, tags; verify processing completes at 1080p.
- Record the public URL in issue #189 before closing it.
