# Jira demo setup (judge-reproducible, ~5 minutes)

All data below is created by hand in a judge-controlled Jira site; ANTICIPATE never seeds data silently.

1. Create a Jira Software project, key `PAY` (any template).
2. Create issues:
   - `PAY-1` "Legacy Auth API v1" — add label `anticipate-change` (marks it as a proposed change).
   - `PAY-2` "Checkout service", `PAY-3` "Mobile backend", `PAY-4` "Partner webhooks", `PAY-5` "Auth API v2".
   - `PAY-6` "Checkout auth contract test".
3. Links (built-in types only):
   - `PAY-1` **blocks** `PAY-2` and `PAY-3`  → Checkout and Mobile depend on the legacy API.
   - `PAY-2` **blocks** `PAY-4`              → Partner webhooks depend on Checkout (transitive impact).
   - `PAY-2` **relates to** `PAY-6`          → shown as INFERRED context. (If a "Test"/"tests" link type exists, use it to make PAY-6 a verifying test.)
   - Optional UNKNOWN evidence: link `PAY-1` **blocks** an issue in a project the demo user cannot browse.
4. Open ANTICIPATE: `https://<site>.atlassian.net/apps/full-page/<installation-id>/hello-world/`.

Expected (deterministic): scenario "Remove now" = BLOCKED (P1 on PAY-2, PAY-3; PAY-4 transitive);
"Retain temporarily" = NEEDS_REVIEW; "Migrate first" (replacement PAY-5) = PASS or NEEDS_REVIEW depending on test links / unknowns.
Approving the plan creates "Migrate …" issues that **block** PAY-1, labels and a decision-record comment, each verified by re-reading Jira.
