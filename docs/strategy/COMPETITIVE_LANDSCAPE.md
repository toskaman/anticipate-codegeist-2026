# Competitive landscape and positioning (ORP-31)

**Purpose.** This brief gives the Devpost text and a future Marketplace listing a "why ANTICIPATE" that we can defend. Every competitor claim links its source. Every ANTICIPATE claim links merged or hosted evidence.

**Read this first: how the sources were checked.**

- **Access date** for every source below: **3 Nov 2026**.
- The sources were found by web search from a cloud runner. From that runner, `support.atlassian.com` and `marketplace.atlassian.com` could not be opened directly: the hosts were not resolvable from this session. So each claim below restates **the text of the page as quoted in the search result**, not a reading of the full page.
- Before any public use (Devpost or Marketplace listing), someone opens each link once and confirms the sentence. Muse or the owner can do this in a browser, see [#64](https://github.com/toskaman/anticipate-codegeist-2026/issues/64).
- **"Not established"** means the source we read did not show the capability. It does **not** mean the product lacks it.
- Pricing, install counts and customer numbers are left out on purpose. We did not verify them.
- The earlier competitive matrix in [docs/product/RESEARCH.md](../product/RESEARCH.md) (Compass/DX, OpsLevel, Bump.sh, JSM) still stands. This brief extends it to the Jira-native alternatives a buyer is most likely to compare us with.

## 1. Comparable products and capabilities

| # | Product (vendor) | What it does, per source | Target buyer | Overlap with ANTICIPATE | Where it stops, per source | Source |
|---|---|---|---|---|---|---|
| 1 | **JSM change risk assessment with Rovo Ops** (Atlassian) | AI risk assessment on change requests. It uses the knowledge bases selected for change risk, plus linked items the user can access. Accepting a suggested mitigation creates a task. The docs say it does not replace human review, and that final decisions stay with change managers and approvers. Premium and Enterprise. | IT operations, change managers (ITSM) | Risk before a change; mitigations become Jira work | Risk scoring and suggested mitigations on **JSM change requests**. A dependency evidence graph with Confirmed/Inferred/Unknown labels, counterfactual alternatives, or a workflow gate tied to a verified decision record: **not established** | [Atlassian Support: assess risks with Rovo Ops](https://support.atlassian.com/jira-service-management-cloud/docs/assess-potential-risks-to-your-changes-with-rovo-ops/), [enable and configure](https://support.atlassian.com/jira-service-management-cloud/docs/enable-and-configure-risks-to-your-changes-with-rovo-ops/) |
| 2 | **Jira Plans dependencies view and scenarios** (Atlassian, formerly Advanced Roadmaps) | Dependencies drawn as arrows between issue tiles. A warning such as misaligned dates turns the arrow red. Scenarios let a planner change scope, capacity or dates in a copy of the plan. Premium and Enterprise. | Program and portfolio managers | Dependency visibility; "what if" planning | One community report (May 2026, cites JRACLOUD-88193) says the scheduler does not shift dependent dates the way Microsoft Project does. That is **unverified**: one user's post. Approvals, verified writes or a decision record: **not established** | [Dependencies view](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-dependencies-report-in-advanced-roadmaps/), [refine the view](https://support.atlassian.com/jira-software-cloud/docs/refine-the-dependencies-report-in-advanced-roadmaps), [community post](https://community.atlassian.com/forums/Jira-questions/Is-Microsoft-Project-style-auto-scheduling-possible-in-JIRA/qaa-p/3242440) |
| 3 | **Dependency graph apps** on the Marketplace, for example Dependency Graph for Jira, Astrolink, LinkMap, STAGIL Link Maps | Interactive graphs of issue links: issue-panel mini graph, multi-project views, filters (Dependency Graph for Jira); force-directed graph up to 5 levels deep with timeline replay (Astrolink); editing links in the map (LinkMap) | Jira teams and project leads | The graph of "blocks" and other links | Visualisation and editing of links. Labels for how sure each relation is, impact simulation, approval gates or an audit passport: **not established** in the listings | [Dependency Graph for Jira](https://marketplace.atlassian.com/apps/2907488740/dependency-graph-for-jira), [Astrolink](https://marketplace.atlassian.com/apps/2775238726/astrolink), [LinkMap](https://marketplace.atlassian.com/apps/1216384/linkmap-the-dependency-graph-editor), [STAGIL Link Maps](https://marketplace.atlassian.com/apps/1230588/stagil-link-maps-work-links-dependency-hierarchy-graphs) |
| 4 | **Release readiness and sign-off apps**, for example Greenlight, Business Sign-off & Approval, Service Transition & Readiness, ReleaseLint | Sign-off gates per release with owners and an audit log (Greenlight). Blocking a transition until approvals are complete (Business Sign-off). Go/No-Go snapshots that cannot be changed afterwards (Service Transition & Readiness). A read-only review of issue dependencies before a version ships (ReleaseLint) | Release managers, change advisory boards | Gates, approvals, immutable decision records | Checklists and approvals that **people** fill in. Deriving the gate from a computed impact on dependent work, with an evidence chain: **not established** | [Greenlight](https://marketplace.atlassian.com/apps/3699874437/greenlight-release-readiness-approvals), [Service Transition & Readiness](https://marketplace.atlassian.com/apps/745802743/service-transition-readiness), [Release Readiness for Jira](https://marketplace.atlassian.com/apps/2207519188/release-readiness-for-jira), [Release Hygiene Guard](https://marketplace.atlassian.com/apps/3787570722/release-hygiene-guard-release-audit-for-jira) |
| 5 | **Workflow validators on linked issues**: JMWE (Appfire), ScriptRunner (Adaptavist) | Block a transition unless linked issues meet configured criteria, for example all blockers done. JMWE notes that remote links are not supported | Jira administrators | A gate on a transition based on linked work | A rule an admin writes about **current** link state. It does not judge whether a removal decision was reviewed and verified | [JMWE Linked Issues Validator](https://appfire.atlassian.net/wiki/spaces/JMWEC/pages/466323119), [ScriptRunner validator examples](https://docs.adaptavist.com/sfjic/latest/features/workflow-rules/workflow-validators/workflow-validator-expression-examples) |
| 6 | **Engineering-intelligence platforms**: LinearB, Jellyfish | Delivery forecasting and risk from Jira and Git data (LinearB). Delivery forecasting, scenario planning and investment reporting (Jellyfish). A third-party comparison says LinearB's Jira forecasting is in its Enterprise tier | Engineering leaders (VP and director level) | Delivery risk, forecasting | Aggregate metrics and forecasts. Per-decision evidence, reviewed Jira writes or a workflow gate: **not established** | [LinearB Jira](https://linearb.io/lp/jira), [Jellyfish vs LinearB (vendor page)](https://jellyfish.co/jellyfish-vs-linearb/), [Tempo comparison](https://www.tempo.io/blog/linearb-vs-jellyfish) |
| 7 | **Compass / DX, OpsLevel, Bump.sh** | Service catalog and dependency maps; spec diffing that flags breaking changes | Platform teams | Dependency and API-change awareness | See [RESEARCH.md](../product/RESEARCH.md) | [RESEARCH.md competitive matrix](../product/RESEARCH.md) |

**Pattern.** Each neighbour covers **one** step:

- seeing links (rows 2–3);
- scoring risk (rows 1, 6);
- gating on a rule or a sign-off (rows 4–5).

None of the sources above showed the full chain in one Jira-native flow: from evidence with an honest confidence label, through alternatives, to a gate fed by a **verified** decision. That is a hypothesis, not a proof of absence; see the method notes.

## 2. Differentiation, limited to what is merged or verified on hosted sites

| Capability | Status | Evidence |
|---|---|---|
| Every relation labelled **Confirmed / Inferred / Unknown**, with its Jira source | Shipped, hosted | [EVIDENCE_PACK, clean-site judge run](../evidence/EVIDENCE_PACK.md) |
| **Decision Firewall** workflow validator: refuses a transition when the plan only *assumes* a migration (R17). Outage policy is Allow by default, admin can switch to Block | Shipped, hosted on dev and on the clean judge site | [EVIDENCE_PACK, validator sections](../evidence/EVIDENCE_PACK.md), [admin guide](../admin/WORKFLOW_VALIDATOR.md) |
| **Prevention plan**: approval and execution are separate steps; each action is "Verified" only after Jira is read back | Shipped, hosted | [EVIDENCE_PACK](../evidence/EVIDENCE_PACK.md), [walkthrough](../jury/WALKTHROUGH_5MIN.md) |
| **Prevention Passport**: alternatives, approvals, timeline and Jira transition status; prints to A4 | Shipped, hosted PDF on dev | [EVIDENCE_PACK](../evidence/EVIDENCE_PACK.md) |
| Invalidated plans: changed evidence blocks execution | Merged ([#94](https://github.com/toskaman/anticipate-codegeist-2026/pull/94)) | [CHANGELOG](../../CHANGELOG.md) |
| **What if it slips?**: due dates moved along "blocks", late releases, "cannot be assessed" | Shipped. Hosted as a Rovo action and as the Scenario Lab panel on the judge site | [EVIDENCE_PACK, slip sections](../evidence/EVIDENCE_PACK.md) |
| Guided demo sample data with staggered due dates, so a slip shows moved dates | Merged ([#126](https://github.com/toskaman/anticipate-codegeist-2026/pull/126)); hosted check pending | [#121](https://github.com/toskaman/anticipate-codegeist-2026/issues/121) |
| Portfolio simulator | **Engine only**, merged ([#129](https://github.com/toskaman/anticipate-codegeist-2026/pull/129), `packages/simulation-core/src/portfolio.ts`). **Not in the UI.** Do not demo it or claim it as a feature | — |

Versions, scopes and test counts: [docs/RELEASE.md](../RELEASE.md) only.

**Positioning line (draft).** *Other tools show the links, score the risk or hold the sign-off. ANTICIPATE connects them: evidence you can trust, alternatives you can compare, and a Jira gate that opens only for a decision that was reviewed and verified.*

The positioning line is our framing (**hypothesis**), not a market fact.

## 3. Buyer and user

| Role | Who | What they need to see |
|---|---|---|
| **User** | Engineering lead or product owner removing or upgrading something others depend on | Who is affected, how sure we are, what to do, in minutes |
| **Approver** | Release manager or change manager | An approval naming the exact actions, then proof they were done |
| **Buyer** | Head of engineering or platform, with the Jira admin as gatekeeper | Least privilege, data stays in Jira and Forge, no lock-in, and a validator that cannot stop the business |

This split is a **hypothesis**. We have no customer interviews to cite.

## 4. Top 5 procurement objections and our honest answers

1. **"We already have Plans and a dependency graph app."**
   - Keep them. ANTICIPATE does not replace visualisation.
   - It adds the decision step those tools do not show in their sources: confidence labels, alternatives, a reviewed plan and a gate.
2. **"An app that can block Jira transitions is a risk."**
   - The validator is opt-in: an admin adds it to a chosen transition.
   - The outage policy defaults to **Allow**.
   - Unreadable issues follow the same policy.
   - Details: [admin guide](../admin/WORKFLOW_VALIDATOR.md).
3. **"What does it write in Jira, and with which rights?"**
   - Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app` ([RELEASE.md](../RELEASE.md)).
   - Writes happen only after a separate approval and a separate execution confirmation, and each one is read back.
   - Existing issues are never modified by the sample data.
4. **"Is the AI making the decision?"**
   - No. The simulation is deterministic (`packages/simulation-core`).
   - "Inferred" and "Unknown" are shown as such.
   - A passing simulation is labelled as not authorising the transition.
   - People approve.
5. **"Data residency and privacy?"**
   - Data stays in Jira and Forge storage.
   - Plans are private to their creator.
   - Details: [PRIVACY.md](../legal/PRIVACY.md) and [THREAT_MODEL.md](../security/THREAT_MODEL.md).
   - **Open point:** request limits are implemented but their production behaviour is still being hardened (2.31.0 incident, see EVIDENCE_PACK). Say so if asked.

## 5. Verified vs hypothesis

| Statement | Class |
|---|---|
| The competitor capabilities in section 1, as worded | Verified from source text as shown by search, **page re-check pending** |
| "Not established" items in section 1 | Not found in the source we read. **Not** a claim that the feature is absent |
| ANTICIPATE capabilities in section 2 | Verified: merged PRs and hosted evidence as linked |
| No neighbour combines evidence, alternatives and a verified-decision gate | **Hypothesis** |
| Buyer and user roles; positioning line | **Hypothesis** |
| Market size, customers, prices, ROI | **Not stated**: we have no data |
