# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | open (owner + orpheane) |
| K2 | Devpost form not filled (mandatory) | HIGH | open; draft in docs/submission |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | CLOSED 3 Nov: ORP-1 (#55) then ORP-2..5 (#56, #57, #60, #61) delivered and merged through GitHub only |
| K4 | Cold start 8 to 11 s | MEDIUM | memoryMB 256 -> 1024 merged (#63), dev 6.3.0 deployed 3 Nov; cold re-measure pending (MUSE-3 #53) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends (happened once on #54; e2e passed afterwards) | MEDIUM | muse waits for all checks before merging; owner may enable "require status checks" on main |
