# Open risks (muse)
| ID | Risk | Severity | Status |
|---|---|---|---|
| K1 | Demo video not produced (mandatory) | HIGH | open (owner + orpheane) |
| K2 | Devpost form not filled (mandatory) | HIGH | open; draft in docs/submission |
| K3 | Orpheane runner unverified: unattended GitHub collaboration not yet proven end to end | MEDIUM | issue ORP-1 is the handshake test |
| K4 | Cold start 8 to 11 s | MEDIUM | re-measure (MUSE-3) |
| K5 | Teamwork Graph blocked by allowlisting | LOW (optional) | waiting on Atlassian |
| K6 | `main` has no branch protection: a PR can merge before CI ends (happened once on #54; e2e passed afterwards) | MEDIUM | muse waits for all checks before merging; owner may enable "require status checks" on main |
