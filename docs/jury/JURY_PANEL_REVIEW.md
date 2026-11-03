# Ten-juror review (EXPERIENCE, 3 Nov 2026)

Simulated reviews of `main` 0e37a1e plus the changes on `feat/product-experience`, using the local MOCK_TRANSPORT build and CORE's hosted reports. They guide priorities; they are not real juror feedback.

| Juror | Understands at once | Does not understand / doubts | Seen as innovative | Could lose trust | Fix now? |
|---|---|---|---|---|---|
| Jira expert | Uses real issues and links; Blocks vs relates-to distinction | Why "relates to" is only Inferred | Transitive impact from plain Jira links | A sample issue shown as Completed while Jira still has open work | Done: limitation line already states it |
| Forge expert | Custom UI, resolvers asUser, Preview modules | Cold start of 8–11 s | Validator + outage policy as an admin setting | Teamwork Graph claims without scopes | No: README already says Jira only; R-38 asks CORE for the contract |
| CTO | Decision firewall framing, Passport as an audit record | "Pass" could read as "safe to ship" | Comparing options on the same evidence | "Migrate first" passing while nothing migrated | **Fixed**: option C labelled as a simulation assumption; Pass says it does not authorize the Jira transition |
| Product designer | One journey, 6 steps, dark default | — | Reason chains in the Firewall | — | No |
| Accessibility expert | List alternative to the graph, keyboard paths, axe on both themes | Native screen-reader pass missing | — | Status shown by colour only | No: every status badge has text; screen-reader pass still open |
| Security expert | Approval and execution are separate, server-checked | Whether the hidden admin switch is the only protection | Evidence-drift refusal with zero writes | UI hiding treated as security | No: server returns PERMISSION_DENIED; acceptance sheet asks CORE to check it hosted |
| Software engineer | Deterministic hashes, idempotent execution | — | Lease + idempotency for retries | — | No |
| Platform lead | API retirement and upgrade flows | How it scales to many teams | Workflow validator gating `anticipate-change` | Single-user plans | Proposal only (shared workspace needs a CORE contract, R-38) |
| B2B investor | Problem in one sentence | Market beyond Jira | Passport as a governance artifact | Invented metrics | No: benchmark labelled as synthetic; value comparison limited to one described dataset |
| 3-minute juror | Guided demo button, graph, verdict | Where the value is after the graph | Passport summary | Long Passport with no short answer | **Fixed**: Passport starts with "In short" (option, verified actions, transition, open questions) |

## Priorities kept
1. Never let a simulation result read as a completed migration or an authorized transition (done).
2. A one-glance Passport answer for decision-makers (done).
3. Hosted acceptance of PR #37 and a clean-site judge run (CORE, `HOSTED_ACCEPTANCE_PR37.md`).
4. Firefox, WebKit and a native screen-reader pass before submission (not available in this environment).
