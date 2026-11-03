# Hosted acceptance: PR #37 (validator outage policy, Passport gate)

Build: `main` 0e37a1e (PR #37) or later. Deployed: dev v4.37.0 and production v2.25.0 (3 Nov, 12:07), per CORE `docs/STATUS.md`. Site: one-atlas-euza, development installation. Only results observed on the hosted app (LIVE_FORGE) go in the Result column. MOCK_TRANSPORT tests are listed separately and are not hosted proof.

Record for each run: date and time (Paris), commit or deployed version, account type (admin / non-admin), result, capture path under `evidence/experience/v4-ux/`.

## Settings: administrator
| # | Step | Expected | Result |
|---|---|---|---|
| A1 | Open Settings | Panel "Workflow validator during an outage" is visible | PASS (CORE, dev, 3 Nov ~12:03, `docs/STATUS.md`) |
| A2 | Read current setting | "During an outage: Allow" (or the stored value) with when it changed | PASS (CORE, dev, 3 Nov ~12:03, `docs/STATUS.md`) |
| A3 | Click Block | Confirmation "Block gated transitions during an outage?" explains the trade-off; Cancel is focused | Not reported separately (the switch was used, so the dialog appeared) |
| A4 | Cancel | Dialog closes, Allow is still selected, nothing saved (Forge log: no `setValidatorPolicy`) | PASS (CORE, dev, 3 Nov): nothing saved, stays Allow |
| A5 | Block → "Block during outages" | Badge shows Block, "Changed … by an administrator" | PASS (CORE, dev, 3 Nov ~12:03, `docs/STATUS.md`): ALLOW → BLOCK |
| A6 | Reload the page | Block is still shown (re-read from the backend) | PASS (CORE, dev, 3 Nov ~12:03, `docs/STATUS.md`): "persisted" |
| A7 | Switch back to Allow and confirm | Allow shown; reload keeps Allow | PASS (CORE, dev, 3 Nov ~12:03, `docs/STATUS.md`): BLOCK → ALLOW |

## Settings: non-administrator
| # | Step | Expected | Result |
|---|---|---|---|
| N1 | Open Settings | Current setting visible with its change date | PASS: 3 Nov 2026, dev, invited account, "Allow · Changed 03 Nov 2026, 12:03 CET by an administrator" |
| N2 | Look for a switch | No Allow/Block control, no "request access" button; text "Only a Jira site administrator can change this setting." | PASS: same run, capture `settings-validator-policy-non-admin-LIVE_FORGE-dev.png` |
| N3 | Backend refusal | `setValidatorPolicy` as non-admin returns PERMISSION_DENIED | NOT TESTABLE FROM THE UI (switch hidden); CORE resolver check, optional |

## Passport
| # | Step | Expected | Result |
|---|---|---|---|
| P1 | MOBL plan "Migrate first", outcome Completed | "In short" says "Jira transition: currently refused…"; row "Closed · the validator refuses it" in amber with the reason | PASS (CORE, MOBL-58, dev 4.39.0 with PR #39): "In short" shown, transition CLOSED with reason |
| P2 | Limitations | "The recorded outcome does not authorize the Jira transition." | NOT RUN |
| P3 | Gated issue with a valid decision | "Open · the validator allows it" in green | NOT RUN |
| P4 | Issue without `anticipate-change` label | "Not gated by the validator", neutral, with reason | NOT RUN |
| P5 | Print or save as PDF (A4) | Summary and gate row each on one page, reason not cut | PASS (CORE, dev, 3 Nov): `evidence/core/passport-MOBL-58-LIVE_FORGE-dev-2026-11-03.pdf`, 3 A4 pages, light palette, "In short" and the CLOSED row intact. One defect found by EXPERIENCE: the three evidence cards wrapped to page 2; fixed on `feat/product-experience` (print keeps them on one row, regression test in `passport-print.spec.ts`) |
| P6 | Screen reader (optional) | Badge text is read as words (status is never colour only) | NOT RUN |

## Network states (MOCK_TRANSPORT only, local)
Loading text, read failure with "Try again", refused save with "Nothing was changed" and re-read, hidden panel when the backend does not advertise `validator:outage-policy`: `static/hello-world/tests/validator-policy.spec.ts`. Timeout and invalid responses go through the shared ForgeClient (timeouts never count as success; invalid payloads are rejected by the contract schema), covered in `reliability.spec.ts` and `schemas.test.ts`.

## Clean judge site (anticipate-judge, production)
CORE run as admin: PASS (`docs/evidence/EVIDENCE_PACK.md`, 3 Nov 13:55–14:02, JDG-1..JDG-6).

Non-admin tour (Orphee, invited account), to record here:
| # | Step | Expected | Result |
|---|---|---|---|
| J1 | Open ANTICIPATE from the judge site | App loads, "Connected · live mode" | NOT RUN |
| J2 | Settings | Outage policy shown read-only, no Allow/Block switch, "Only a Jira site administrator can change this setting." | NOT RUN |
| J3 | Mission Control → recover or open the JDG-1 Passport | Passport loads for a plan the viewer can access | NOT RUN |
| J4 | Passport JDG-1 | "In short": Completed, 1 of 1 verified; "Jira transition" row with its status | NOT RUN |

Note for J3: plans are private to the person who created them (`docs/STATUS.md`). A non-admin who did not create the JDG-1 plan may be refused; that refusal is the expected behaviour, not a defect.
