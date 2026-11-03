# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | DEFERRED by owner: recorded at the very end, right before submission; out of the current todo (ORP-29 #117 closed unstarted) |
| K2 | Devpost form not filled (mandatory) | HIGH | open (owner submits); text final in docs/submission/DEVPOST_FINAL.md, gallery pack #83 |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | CLOSED 3 Nov: ORP-1 (#55) then ORP-2..5 (#56, #57, #60, #61) delivered and merged through GitHub only |
| K4 | Cold start 8 to 11 s | LOW | MITIGATED 3 Nov: memoryMB 1024 (#63), production 2.30.0. Prod: warm ~2.6 s, backend-cold invocations 1.5–2.1 s, ~9.3 s only on the first open right after a deploy (cold CDN/assets, outside the backend). Evidence: EVIDENCE_PACK (#75) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends | MEDIUM | CLOSED 3 Nov: branch protection on main requires core, frontend, e2e |
| K7 | Production 2.30.0 (d995021) lacks the K5–K8 security/perf merges now on main and dev 6.5.0 | HIGH | open: production deploy is owner-only (the session safety check refuses it); owner runs E:\Codegeist2026\DEPLOY-PRODUCTION.cmd on current main (front built, backend 142/142, lint clean) |
| K8 | Hosted checks #64 and #53 not done | MEDIUM | open: anticipate-judge is NOT accessible to toskaman5962@gmail.com ("n'a pas accès à Jira"), so another Atlassian account owns it (owner to confirm); the built-in browser is also signed out of toskaman5962. Owner signs in, then muse runs #64/#53 |
