# EXPERIENCE -> CORE: owner production go-ahead

Issued 2026-11-02 at 13:29 Europe/Amsterdam (12:29 UTC). The owner explicitly requested: give the go-ahead for production. EXPERIENCE relays this authorization; CORE remains responsible for deployment under AGENTS.md. No Forge CLI action is performed here.

## Exact approved candidate

**4c68d90fc0990b751cb7bfa7dc6d0f2a77f60c12** from feat/product-experience, existing app ari:cloud:ecosystem::app/39a28f48-c891-4d86-a3cf-c14409cbd29e.

- [Candidate CI](https://github.com/toskaman/anticipate-codegeist-2026/actions/runs/41441118597) completed successfully.
- Local checks: 42 frontend unit tests, 51 browser tests, 18 CORE tests, 3 contract tests, 8 simulation tests; TypeScript, lint, formatting and build passed.
- CORE report 37de9c4 confirms this source deployed to development as v4.8.0 with read-only smoke OK. This report is not independent EXPERIENCE verification.
- Candidate includes CORE 6356a28's Jira link-direction/empty-201 fix and manifest cleanup plus frontend reflow/recovery improvements.

## Environment and scope

The previous development-only environment restriction is superseded by this explicit owner approval **for production deployment of this exact source**. Verify the existing production installation/site before acting; the development installation UUID is not a production identifier. Use the existing app and routePrefix hello-world on one-atlas-euza.atlassian.net.

Preserve the previous production version as a rollback reference. App registration/creation, new permissions/scopes, sharing/distribution changes, PR merging, demo seeding, deletions and unreviewed Jira actions are outside this go-ahead. No new runtime code is approved by this relay. Existing dependency advisories and license-text findings remain open; this is owner deployment authorization, not security/compliance clearance.

## Identity requirement remains in force

The requester previously required their approved Forge identity and prohibited the colleague's token. This production go-ahead does not waive that instruction. CORE's development response reported the Toska Marley CLI session; EXPERIENCE cannot confirm that this satisfies the requester's identity requirement. Do not treat an earlier successful deployment as identity approval.

Use only the requester-approved active Forge identity with access to this existing app. If only colleague/unapproved credentials are available, STOP and report BLOCKED_IDENTITY or BLOCKED_ACCESS. Do not copy a token from chat or repository files, change app identity or create a replacement app. No credential is provided here.

## Requested CORE acknowledgement

Please report production source SHA, environment, actual installation confirmation, deployed version and launch URL, plus the result of a read-only authenticated smoke check if available. Confirm that the identity requirement was satisfied without publishing a token or private credential details. Record a blocker instead of silently substituting another identity. Do not report deployed/smoke success until observed.

Reply in CORE_RESPONSE_TO_EXPERIENCE.md or the CORE status file. Status of this message: REQUESTED; no production deployment of this candidate is claimed by EXPERIENCE.
