# Judge installation link (Jira, latest production deployment)

Distribution status: **Sharing with anyone** (enabled 2026-11-02 ~13:00 UTC, developer console).

https://developer.atlassian.com/console/install/39a28f48-c891-4d86-a3cf-c14409cbd29e?signature=AYABePXslbor3YLj%2BTcemXPjP3gAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB1P6Eto63k78iuvrNITOSwQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDNvj4TMCYpfhpEaaPgIBEIA7AzDa0tjeiSuqUQqhvrJJdLsoK0RiP%2B2vvK3S18HWXvShy4wakbezFezX8qIfOrM3CEqWfWgX2nPbkZgAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFphpOPKMykrrveD6ylIpTlAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMYwyN2sckWxCJS1uvAgEQgDu25O%2FQQQmfrnuQ5v2WQ3BzAR%2FcSOKMAkTHSl6XlfYjWH5j6yVenAk1HB12RlHjnOPPIsOuyAK8Tp9ZxAAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAcjOYKh1BCv7d1W6NATkqpwAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxdjI8MZ%2FYN2GDUJc0CARCAO8WrJYz8YuQbd3c4nWyL2dsdiMWujOkWcM5BBsz4O1jP7mZfffCju755mDv9rKM8zKOZHyIqs%2BwuPrWpAgAAAAAMAAAQAAAAAAAAAAAAAAAAABcBYGD4TzT%2BLgcu%2FMAyvvv%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKbEy%2FsDjBb7IYVBZ0RkvWqYsmosYuEW%2BYGd6dSUb1GZ%2BHnjw4pJfTQ5Ov8ZpGIeBnSP4J4RYfB7x%2F9QYSsB2gRX%2BA%3D&product=jira

## Before installing (prerequisites)
- A Jira Cloud site that includes **Jira (software projects)**. A site with only Jira Service Management cannot host the demo: its service projects do not let apps create sample tickets (verified on our own clean site, which has only Service Management).
- A **company-managed software project** you can edit (Kanban or Scrum template), or permission to create one. A free Jira site is enough.
- Optional: Rovo on the site for the Rovo agent; an org admin enabling "Expose tools to MCP-compatible apps" for the MCP tools.

## After installing
1. Open Jira, then **Apps → ANTICIPATE** (or `https://<site>.atlassian.net/apps/full-page/<installation-id>/hello-world/`; the installation id is on the site's Apps > Manage apps page). The first open can take about 10 seconds while Forge starts.
2. Click **Start the guided demo**, choose your software project, **Preview sample data**, then confirm. Six labelled issues and four "blocks" links are created (about 15–20 s the first time); existing issues are never modified.
3. **Analyze** the sample root, compare options, open the Decision Firewall, generate a plan, approve **all** actions, execute, then open the Prevention Passport.
4. Optional: add the "ANTICIPATE Decision Firewall" validator to a transition of a test workflow (Project settings → Workflows → Edit). Issues labelled `anticipate-change` then need a completed, non-blocked, verified plan to move forward. Behaviour during outages (Allow by default, Block opt-in) and how to change it: [docs/admin/WORKFLOW_VALIDATOR.md](../admin/WORKFLOW_VALIDATOR.md).

Manual demo setup without the guided flow: docs/demo/JIRA_DEMO_SETUP.md.

Support: info@lepcpro.fr · Privacy: docs/legal/PRIVACY.md · Terms: docs/legal/TERMS.md
The link always installs the latest production deployment, currently **4.6.0** (main 49e1f40, code = b1e4677 incl. the Release Command Center + wow #233, deployed 10 Nov 2026 12:52:55 UTC, vars stamped 12:48:19Z). Verified 8 Nov on the live consent page: exactly 4 scopes (Jira read/write, user profiles, app storage), no graph scopes — new installs receive the shipping build incl. the Release Command Center (screenshot docs/evidence/hosted-2026-11-08/24-install-consent-4x.png). Existing installs: toskaman5962 is on 4 (Up-to-date); anticipate-judge is still on major 2 pending its site admin's upgrade click (same 4 scopes, no new permissions). History: a production major 3 (6 Nov, experimental TWG manifest, never installed) was superseded by the 4.0.0 deploy. Full record: docs/deployment/PROD_RELEASE_CANDIDATE.md; parity: docs/evidence/VIDEO_SHIPPING_PARITY.md.


## Notes from the clean-site run (3 Nov 2026)
- The install page lists only the sites where the signed-in Atlassian account is an admin. If your site is missing, switch account (avatar, top right) to the site admin.
- Jira Free works for the full demo. Limited-permission roles cannot be configured on Free; they are covered by automated tests.

## Optional: turn on the Jira workflow gate (5 steps, company-managed project)
1. Project settings > Workflows > edit the workflow.
2. Select the transition to protect (for example "In Progress").
3. Rules > Add rule > Validate details > "ANTICIPATE Decision Firewall".
4. Save and publish the workflow.
5. Label the change issue `anticipate-change`. The transition is refused until its ANTICIPATE plan is completed and verified, and refused again if the plan only assumes a migration Jira does not show yet.
