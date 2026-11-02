# ANTICIPATE — Privacy Policy

Last updated: 2 November 2026

ANTICIPATE is an Atlassian Forge app built for Codegeist 2026. It runs entirely on Atlassian's Forge platform ("Runs on Atlassian"); no data is sent to servers operated by the ANTICIPATE team.

**What the app reads.** Jira projects, issues, issue links, components and your Jira permissions, always with your own Atlassian permissions (Forge `asUser`). It only reads what you can already see.

**What the app stores** (Forge key-value storage, inside the installing site's Atlassian tenant):
- evidence-graph snapshots (issue keys, summaries, link types) — expire after 24 hours of use;
- scenario comparisons, prevention plans and execution records;
- the Atlassian **accountId** of the user who created or approved a plan, and approval timestamps (audit trail).

**What the app writes to Jira**, only after an explicit human approval of each action: new issues, issue links, labels and comments, exactly as listed in the reviewed plan.

**Not collected:** no analytics, no tracking, no third-party services, no AI/LLM processing of your data, no sale or sharing of data.

**Retention and deletion.** Data stays in Forge storage for the installing site and expires automatically: full dependency snapshots after 2 days; plans, comparisons, execution records and a minimized decision provenance record (identifiers, counts and reviewed dependency relations, no issue text) after 90 days; locks after 1 day; idempotency keys after 7 days. Everything is removed when the app is uninstalled (per Forge storage behaviour). Contact us to request earlier deletion.

**Contact.** See the support contact on the app's installation page.
