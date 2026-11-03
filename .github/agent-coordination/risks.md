# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | open (owner records); script VIDEO_SCRIPT.md, caption pack ORP-29 (#117) |
| K2 | Devpost form not filled (mandatory) | HIGH | open (owner); text final in docs/submission/DEVPOST_FINAL.md, gallery pack #83, video captions ORP-29 (#117) |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | CLOSED 3 Nov: ORP-1 (#55) then ORP-2..5 (#56, #57, #60, #61) delivered and merged through GitHub only |
| K4 | Cold start 8 to 11 s | LOW | MITIGATED 3 Nov: memoryMB 1024 (#63), production 2.30.0. Prod: warm ~2.6 s, backend-cold invocations 1.5–2.1 s, ~9.3 s only on the first open right after a deploy (cold CDN/assets, outside the backend). Evidence: EVIDENCE_PACK (#75) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends | MEDIUM | CLOSED 3 Nov: branch protection on main requires core, frontend, e2e |
| K7 | Production 2.30.0 (d995021) lacks the K5–K8 security/perf merges now on main and dev 6.5.0 | HIGH | open: owner production deploy (DEPLOY-PRODUCTION.cmd) |
| K8 | Hosted checks #64 and #53 not done: anticipate-judge not signed in in the browser pane, app page URL on toskaman5962 not found | MEDIUM | open: owner signs in on anticipate-judge in the built-in browser, then muse runs #64/#53 |
