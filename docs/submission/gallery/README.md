# Devpost gallery pack (diagrams, not screenshots)

Built from repository facts only. These are diagrams, not captures of the running app; hosted LIVE_FORGE screenshots come from muse/owner (#64). PNGs are rendered from the SVGs with Playwright (Chromium) at 1500×1000.

| Image | Caption (≤ 140 chars) | Source of each fact |
| --- | --- | --- |
| `01-cover.png` | ANTICIPATE turns a proposed change in Jira into an evidence-backed decision. Test the consequences. Prove the safeguards. Then ship. | Name, tagline and value line verbatim from `DEVPOST_FINAL.md`; module pills from `manifest.yml` (`global:fullPage`, `rovo:agent`, `rovo:mcp` with 7 tools, `jira:workflowValidator`) |
| `02-architecture.png` | How it is built: Forge Custom UI, resolvers running as the user, a deterministic engine, Rovo and MCP read-only tools, a Jira validator. | `manifest.yml` modules and scopes; paths `static/hello-world`, `src/main.ts`, `src/engine/*`, `src/jira`, `src/rovo.ts`, `src/validator.ts`, `packages/simulation-core`, `packages/contracts` |
| `03-slip-propagation.png` | What if it slips? A 5-day delay moves two dependents and makes release v2.0 4 days late; undated issues stay Unknown. Sample data. | Values from `packages/simulation-core/test/slip.test.ts` (first two tests); rules from `packages/simulation-core/src/slip.ts` (A1–A4); 50-issue limit `SLIP_MAX_ISSUES` and unreadable → Unknown in `src/engine/slip-service.ts` |

Each SVG has its own solid background, so it reads the same on light or dark pages. It uses system fonts only (no external fonts) and text of 18 px or more at 1500 px wide.
