# Hosted acceptance T8 — Release Command Center + portfolio collision on dev 8.1.0

Date: 8 Nov 2026, ~02:35–02:50 CET (01:35–01:50 UTC).
Environment: development site `one-atlas-euza`, major 8 (8.1.0 INFERRED-STRONG
per DEV_RELEASE_CANDIDATE.md), installation `2ae8efdf-…`, co-owner browser session (capture profile signed in as the second co-owner's Atlassian account; Forge CLI session is Toska Marley). Method: CDP-driven capture browser (text-first +
screenshots). Jira writes in this session: **zero** — navigation, one
app-storage snapshot, and read-only simulations only; no approve, execute,
or sample-creation confirm clicked.

This session extends HOSTED_ACCEPTANCE_T7 (6/6 read-only journey steps) into
two areas T7 explicitly left uncovered: the Release Command Center and the
portfolio collision workflow. It does not re-run the T7 journey.

## 1. Release Command Center on AVT — PASS (LIVE_FORGE_DEV)

Mission Control → project AVT (context AVT · AVT-3 · Migrate first ·
Completed). The RCC section rendered a read-only digest (after an honest
"Reading release data…" loading state):

- Release "Unscheduled — 3 change(s)". Next: "Unblock the release".
- AVT-1: Needs review / No recorded decision → "Analyze AVT-1".
- AVT-3: Blocked / COMPLETED — BLOCKED / Fresh → "Analyze AVT-3".
- AVT-9: Needs review / No recorded decision → "Analyze AVT-9".
- Unknown-evidence disclaimer present (labelled-changes-only scope,
  private decisions counted as missing).

Release Safety rendered below with the fixVersion input and "Show all
releases needing attention". Text captured in full; the table UI is shown
in `20-rcc-td-dev-8x.png` (TD context, same component).

## 2. Project switch AVT → TD — PASS, no stale data (LIVE_FORGE_DEV)

Selected TD (Tally Dev) in the project picker. Context pill switched to
TD cleanly; Mission Control, RCC, and journey steps all reflected TD:

- RCC on TD: "Unscheduled — 1 change(s)" (TD-1 only), Next: "Close the
  evidence gaps". No AVT change leaked into the TD digest.
- Screenshot: `20-rcc-td-dev-8x.png`.

## 3. TD-1 analysis — PASS (LIVE_FORGE_DEV)

"Analyze dependencies" on TD-1 → Evidence Graph: 8 records, 8 relations,
6 confirmed, 2 inferred, 0 unknown; snapshot captured 08 Nov 2026,
02:37 CET. TWG source honestly "Not configured" (allowlist pending).
Screenshot: `21-td-analysis-dev-8x.png`.

## 4. Portfolio DEMO 2 combined run — PASS (LIVE_FORGE_DEV)

Scenario Lab → "Several changes at once", on the frozen TD snapshot:

- Change A "move TD-1 consumers to TD-5": Migrate dependents, TD-1 → TD-5.
- Change B "breaking upgrade of TD-5": Upgrade · breaking, TD-5.
- Combined simulation: **Needs review**.
- EMERGENT_IMPACT: TD-2, TD-3, TD-4, TD-6 impacted only together, with
  witness paths combining A + B.
- MIGRATE_ONTO_RETIRED: A migrates onto TD-5 while B breaks TD-5.
- Suggested order A → B; per-change A alone PASS (0 impacted) → together
  NEEDS_REVIEW (4 impacted); "leaving it out changes the portfolio verdict".
- Honest framing throughout: frozen-snapshot banner, TWG coverage note,
  "This is not authorization to execute".
- Screenshot: `22-portfolio-demo2-dev-8x.png`.

## Still not covered here (unchanged)

New approval/execution writes, fresh evidence-change refusal, external
MCP/Rovo calls, two-account authorization (#131), judge clean-site rerun
on the shipping build (#191). Causal Collision Explorer drill-down was
not opened in this session (collision explanations listed, not expanded).
