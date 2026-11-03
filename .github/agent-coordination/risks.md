# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | open (owner + orpheane) |
| K2 | Devpost form not filled (mandatory) | HIGH | open; draft in docs/submission |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | CLOSED 3 Nov: ORP-1 (#55) then ORP-2..5 (#56, #57, #60, #61) delivered and merged through GitHub only |
| K4 | Cold start 8 to 11 s | LOW | MITIGATED 3 Nov: memoryMB 1024 (#63), production 2.30.0. Prod: warm ~2.6 s, backend-cold invocations 1.5–2.1 s, ~9.3 s only on the first open right after a deploy (cold CDN/assets, outside the backend). Evidence: EVIDENCE_PACK (#75) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends | MEDIUM | CLOSED 3 Nov: branch protection on main requires core, frontend, e2e |
