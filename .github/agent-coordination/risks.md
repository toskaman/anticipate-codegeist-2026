# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | DEFERRED by owner: recorded at the very end, right before submission; out of the current todo (ORP-29 #117 closed unstarted) |
| K2 | Devpost form not filled (mandatory) | HIGH | DEFERRED by owner: filled at the very end together with the video; text final in docs/submission/DEVPOST_FINAL.md, gallery pack #83 |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | CLOSED 3 Nov: ORP-1 (#55) then ORP-2..5 (#56, #57, #60, #61) delivered and merged through GitHub only |
| K4 | Cold start 8 to 11 s | LOW | MITIGATED 3 Nov: memoryMB 1024 (#63), production 2.30.0. Prod: warm ~2.6 s, backend-cold invocations 1.5–2.1 s, ~9.3 s only on the first open right after a deploy (cold CDN/assets, outside the backend). Evidence: EVIDENCE_PACK (#75) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends | MEDIUM | CLOSED 3 Nov: branch protection on main requires core, frontend, e2e |
| K7 | Production 2.30.0 (d995021) lacks the K5–K8 security/perf merges now on main and dev 6.5.0 | HIGH | open: production deploy is owner-only (the session safety check refuses it); owner runs E:\Codegeist2026\DEPLOY-PRODUCTION.cmd on current main (front built, backend 142/142, lint clean) |
| K8 | Hosted checks #64 and #53 | MEDIUM | #64 slip panel PARTIAL on anticipate-judge (#123; propagation needs dated sample tickets, ORP-30 #121). anticipate-judge is owned by another Atlassian account than toskaman5962 (owner signed in). #53 burst test open, after the production deploy |
| K9 | Bridge accepted unsigned requests | MEDIUM | CLOSED 3 Nov ~22:34 UTC: HMAC key active (file option), signed/unsigned/malformed/wrong-key probes as expected (#107) |
