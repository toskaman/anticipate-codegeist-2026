# Jury UI showcase (v3)

All referenced images are **MOCK_TRANSPORT** captures (see `docs/design/UI_VISUAL_QA.md`). For the
submission video, record the same sequence on the real installation at 1920 × 1080.

## Best stills — `evidence/experience/v3-redesign/visual/`

| Image | What it proves |
| --- | --- |
| `01-mission-control-first-run-desktop-dark.png` | Starts from a real Jira issue; honest guarantees; recovery path. |
| `04-evidence-graph-causal-path-desktop-dark.png` | Signature view: the simulated path from the change to an affected record, with the Jira source of every step. |
| `03-scenario-lab-desktop-dark.png` | Three options, three different policy outcomes; suggestion ≠ approval. |
| `05-decision-firewall-blocked-desktop-dark.png` | Why an option is blocked: change → dependency → policy → review step. |
| `09-execution-confirmation-desktop-dark.png` | Execution is a separate, explicit, red-flagged step. |
| `10-prevention-plan-partial-desktop-dark.png` | Mixed outcomes stay mixed: 3 verified, 1 failed, nothing retried. |
| `11-prevention-passport-desktop-light.png` | The proof: alternatives, approvals, receipt, timeline, limitations. |

## Three-minute recording sequence

1. **0:00 The question** — Mission Control: choose project, load candidates, pick the change,
   *Analyze dependencies*.
2. **0:30 The evidence** — Evidence Graph: point at Confirmed / Inferred / Unknown counts; open the
   Unknown record (access limited).
3. **0:55 The alternatives** — Scenario Lab: choose the replacement, *Compare options*; read the three
   verdicts; note the suggestion is not an approval.
4. **1:25 The causal path** — back to Evidence Graph, *Show simulated impact for → Remove now*,
   select a transitive record; the path lights up with sources.
5. **1:50 The decision** — select *Remove now* → Decision Firewall shows *Policy blocks this option*;
   switch to the suggested option; *Generate prevention plan*.
6. **2:20 Human control** — approve actions (dialog: no Jira write), then *Execute approved actions*
   (dialog: can write to Jira).
7. **2:45 The proof** — Verify results, then *Open Prevention Passport*; show print/PDF.

Only claim on camera what the real installation shows in that run.
