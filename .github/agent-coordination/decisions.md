# Decisions (muse)
- D1 (3 Nov): Bonus claimed = **Best app with Atlassian MCP** (6 read-only `rovo:mcp` tools since the slip simulation was added on 3 Nov, also used by the `rovo:agent`). Only one bonus can be won; Best Agents is eligible too but MCP has the stronger hosted evidence. Teamwork Graph is not claimed (allowlist ECOHELP-180616).
- D2 (3 Nov): Teamwork Graph provenance keeps `FULL`; `needsAdmin` and per-relation fields extend `coverage[]` (accepted with EXPERIENCE).
- D3 (3 Nov): Shared workspace stays a tested backend prototype until hosted two-account tests pass; private plans remain the default.
- D4 (3 Nov): Next differentiator = deterministic "what-if slip" simulation on Jira dates and dependencies (assumptions explicit, no invented probabilities).
- D5 (4 Nov): Wave 1 of the master mission = P0 storage-contract hardening + two P1 engine slices that are pure or unwired (low blast radius): portfolio simulator (simulation-core, not yet exposed via Forge) and workspace concurrency fix (still a PROTOTYPE, not wired). Forge exposure and UI come in wave 2 after review.
- D6 (4 Nov): Test store fakes enforce the Forge KVS key contract (`[a-zA-Z0-9:._ -#]`, <= 500 chars). The throttle wiring test now passes identity through the Forge runtime payload (it never did before, which is why the 2.31.0 outage was not caught); it fails on the pre-hotfix throttle.
- D7 (4 Nov): Throttle stays fail-open on storage errors (availability over abuse control): every operation still enforces its own Jira authorization, and the throttle only limits volume. Revisit if a hosted abuse case appears.

