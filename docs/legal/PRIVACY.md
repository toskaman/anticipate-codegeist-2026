# ANTICIPATE — Privacy Policy

Last updated: 3 November 2026

ANTICIPATE is an Atlassian Forge app built for Codegeist 2026. It runs entirely on Atlassian's Forge platform ("Runs on Atlassian"); no data is sent to servers operated by the ANTICIPATE team.

**What the app reads.** Jira projects, issues (summary, status, type, labels, links, components, due date, fix versions and their release dates), your Jira project permissions and whether you are a Jira site administrator (only to decide who may change the validator outage policy), always with your own Atlassian permissions (Forge `asUser`). It only reads what you can already see.

**What the app stores** (Forge key-value storage, inside the installing site's Atlassian tenant):
- evidence-graph snapshots (issue keys, summaries, link types): usable for 24 hours, then deleted from storage after 2 days;
- scenario comparisons, prevention plans and execution records;
- decision attestations used by the workflow validator (per issue: plan identifiers, verdicts, a digest of the issue's links and an expiry date; no issue text, no accountId);
- the validator outage policy (Allow or Block), with the **accountId** of the administrator who last changed it and when;
- the Atlassian **accountId** of the user who created or approved a plan, and approval timestamps (audit trail).

**What the app writes to Jira**, only after an explicit human approval of each action: new issues, issue links, labels and comments, exactly as listed in the reviewed plan.

**Logs.** The app writes operational logs to Forge (kept by Atlassian under its own retention): operation names, error codes and durations; when an administrator changes the validator outage policy, their **accountId** and the new value; when the validator cannot verify a transition, the outage reason and a short error detail (which may include an issue key).

**In your browser.** Display preferences (theme, text size, contrast, motion) are kept in your browser's local storage. The last plan ID you opened and per-plan execution markers are kept in session storage, which is cleared when the tab closes. None of this is sent to the ANTICIPATE team.

**Rovo and MCP.** ANTICIPATE itself calls no AI model. If you ask about a change from Rovo chat or from an MCP client that an administrator connected, the read-only tool results (issue keys, dependencies, dates, verdicts) go to that assistant, under Atlassian's or that client's terms.

**Not collected:** no analytics, no tracking, no third-party services operated by the ANTICIPATE team, no sale or sharing of data.

**Retention and deletion.** Data stays in Forge storage for the installing site and expires automatically: full dependency snapshots after 2 days; plans, comparisons, execution records and a minimized decision provenance record (identifiers, counts and reviewed dependency relations, no issue text) after 90 days; locks after 1 day; idempotency keys after 7 days. Decision attestations follow the 90-day rule (the validator stops accepting them after 14 days). The validator outage policy is configuration and does not expire until the app is uninstalled. Everything is removed when the app is uninstalled (per Forge storage behaviour). Contact us to request earlier deletion.

**Contact.** See the support contact on the app's installation page.
