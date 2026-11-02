# ANTICIPATE design system v3 — "Precision Intelligence"

Source: `static/hello-world/src/styles/anticipate.css` (scoped to `.ax-app`), `src/components/`.

## Principles

1. Semantics before decoration — colour always paired with an icon and text.
2. Simple by default, detailed on demand — IDs, hashes and payloads live in *Technical details*.
3. Truth over polish — no value is shown that the backend did not return.

## Tokens

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--ax-bg` | `#080d15` | `#f4f6f9` | Page |
| `--ax-surface` / `-2` / `-3` | `#0d141f` / `#111a27` / `#172232` | `#fff` / `#f8fafc` / `#eef2f7` | Panels, insets, chips |
| `--ax-border` / `-strong` | `#1e2a3a` / `#2d3c51` | `#e0e6ee` / `#c9d3df` | Dividers, controls |
| `--ax-text` / `-2` / `-3` | `#e7edf5` / `#a9b6c7` / `#9dabc0` | `#0b1524` / `#3d4b5d` / `#47566a` | Primary, secondary, metadata |
| `--ax-accent` | `#2fd3bd` | `#0b655e` | Brand, primary action, confirmed evidence |
| `--ax-info` | `#7ea6ff` | `#2953c7` | Inferred evidence, information |
| `--ax-warning` | `#fbbf24` | `#8f5200` | Unknown evidence, needs review |
| `--ax-danger` | `#fb7185` | `#b91c1c` | Blocked, failed, execute |
| `--ax-success` | `#4ade80` | `#126531` | Verified outcome, pass |
| `--ax-violet` | `#a78bfa` | `#5739b5` | Simulation overlay, suggestions |

Evidence aliases: `--ax-ev-confirmed` (accent, solid line), `--ax-ev-inferred` (info, dashed),
`--ax-ev-unknown` (warning, dotted). Light-theme text tokens were chosen for ≥ 4.5:1 on white;
this was not machine-verified with axe in the authoring environment.

Spacing: 4 px grid (`--ax-1` … `--ax-12`). Radii 6 / 8 / 12 px. Motion: `--ax-fast` 120 ms,
`--ax-med` 200 ms, `--ax-slow` 280 ms, easing `cubic-bezier(.2,.8,.2,1)`.

## Typography

System stacks only (no font request; Forge-CSP safe). Base 15 px / 1.55.
Display 26–36 px (hero only) · H1 28 px · H2 18 px · H3 16 px · section labels 12.5 px uppercase ·
metadata 12.5–13.5 px · identifiers in `--ax-mono` at 0.86 em, wrapped anywhere.

## Components

| Component | File | Notes |
| --- | --- | --- |
| `Badge` | `components/ui.tsx` | Tone + icon + text; `sm` / `md` / `lg`. |
| `PageHeader` | `ui.tsx` | Step eyebrow, H1, lead, actions — every screen. |
| `Panel`, `EmptyState`, `Notice`, `TechDetails`, `KeyValues`, `Metric`, `SourceLink` | `ui.tsx` | `SourceLink` only links `https:` URLs and announces new tabs. |
| `EvidencePath` | `components/EvidencePath.tsx` | Ordered backend path; missing edges shown as missing. |
| `DecisionDialog` | `components/DecisionDialog.tsx` | Native `<dialog>`, focus starts on Cancel, trap, Escape, focus restore. |
| `Icon` | `components/Icon.tsx` | 31 inline stroke icons, `aria-hidden`. |
| `CoreOperationError` | `CoreOperationError.tsx` | Same guidance strings as before, restyled. |

## States

Verdict: Blocked (danger/octagon) · Needs review (warning/alert) · Pass (success/check, with
"not safe" copy). Plan: Awaiting approval · Approved · not executed · Executing · Completed ·
Partially completed · Failed · Expired. Execution record: Pending · In progress · Submitted ·
unverified · Verified · Failed · Skipped; plus UI-derived *Outcome uncertain* when execution was
requested and no record exists. Capability: Available · Not configured · Not supported ·
Permission required · Disabled by budget.

## Motion

Page fade (200 ms), rise-in for chain steps, path steps and timeline (staggered ≤ 180 ms), dialog
pop, one-shot pulse on Verified records only. No infinite decorative animation (the spinner only
runs while a request is pending). `prefers-reduced-motion: reduce` collapses all to 1 ms.

## Responsive rules

≥ 1920: content max 1600 px, graph inspector 420 px. 1600–1919: inspector 380 px beside the map.
< 1600: inspector below the map in two columns. < 1280: reasons chain 2×2. < 1100: scenarios
stack. < 1024: sidebar becomes a horizontal stage scroller. ≤ 720: single column everywhere,
large buttons full width. ≤ 380: dialog actions stacked.

## Accessibility guidance

Landmarks: `aside` + `nav` (Workspace screens), `header`, `main#main` (skip link), `footer`.
Nav buttons keep the exact screen name as accessible name; step state is in `aria-describedby`.
Scenario selection is a native radio group. Graph nodes are focusable (Enter/Space selects); the
Evidence list is the equivalent non-graph control. Status never relies on colour alone.
`prefers-contrast: more` and `forced-colors: active` are handled.

Integration follow-up: page/card entry uses transform motion without fading text opacity, so text remains readable during transitions. Evidence-change notices and sample previews/confirmations use the same semantic primitives. Mobile graph starts at readable zoom instead of fitting every lane into unreadable labels.

## v4 additions (Nov 2026)

Display preferences live on `.ax-app` as data attributes (`data-theme`, `data-text-size`, `data-contrast`, `data-motion`, `data-focus`, `data-links`, `data-layout`), set from `app/preferences.ts` and stored per browser only. Defaults (`theme: system`, others standard) keep following the Atlassian host theme and OS preferences; the explicit attributes add to, never replace, the `prefers-*` media rules. Text size overrides the `--ax-fs-*` tokens; component font sizes must use those tokens, not raw px.

New patterns:

- **Guided demo callout** (`.ax-demo`): the single accent-bordered block on Mission Control; one primary CTA, three numbered steps with `aria-current="step"`. Top bar repeats it as a compact "Start demo" button. Use once per screen at most.
- **Display & accessibility menu** (`.ax-prefs-menu`): non-modal disclosure (`aria-expanded`/`aria-controls`, `role="dialog"`), Escape and outside click close, focus returns to the trigger. Controls are native radios styled as segmented buttons (`.ax-segmented`). Same component renders inline in Settings.
- **Change-kind picker** (`.ax-kind`): native radio cards in a `fieldset`. An option the backend does not advertise is disabled *and* explained in text; never hidden silently, never faked.
- **Open questions list** (`.ax-open-questions`): warning badge with the uncertainty reason + record name. Name the record; do not only count.
