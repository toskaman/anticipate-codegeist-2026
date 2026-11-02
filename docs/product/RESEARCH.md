# Product research and positioning

Reviewed 2026-11-02. Desk research using primary vendor/research sources; no customer interviews, paid trials, revenue, adoption or production outcomes have been measured. All persona and pricing statements below are hypotheses.

## Primary audience and job

Hypothesis: a platform engineering lead or release manager coordinating retirement of an authentication API across checkout, mobile, support and delivery teams. Their job is to identify affected consumers and missing owners, compare retirement options on one evidence snapshot, collect scoped approval and retain the observed outcomes. SRE and technical program managers are secondary stakeholders, not separate implemented use cases.

The narrow P0 use case remains API v1 deprecation before release. A research paper studies REST API deprecation and its implications for dependent applications; it supports investigating the problem, not a claim of ANTICIPATE customer demand or prevented incidents. [Primary research](https://arxiv.org/abs/2008.12808)

## Competitive matrix

Vendor-documented means supported by the linked source, not independently tested by this team. Not established means the reviewed source did not establish the feature; it does not mean the competitor lacks it.

| Product | Vendor-documented overlap | What this review does not establish | ANTICIPATE implication |
|---|---|---|---|
| Atlassian Compass / DX transition | Component catalog, dependency map and software health scorecards are documented. Atlassian states catalog/scorecard functionality is transitioning into DX. [Catalog](https://www.atlassian.com/software/compass/software-catalog), [transition notice](https://developer.atlassian.com/cloud/compass/integrations/get-started-integrating-with-Compass/) | No claim here that Compass is fully discontinued, or that DX lacks any decision workflow | A graph/catalog alone is not novel. Reuse context rather than compete on inventory alone. |
| OpsLevel | Component dependency/dependent views and an interactive dependency graph. [Vendor docs](https://docs.opslevel.com/docs/service-dependencies) | Three counterfactual retirement alternatives and our specific approval/passport loop were not established by this page | Show why evidence quality and decisions matter beyond graph visualization. |
| Bump.sh | API-definition changes, automatic changelog and breaking-change identification. [Vendor docs](https://docs.bump.sh/help/api-change-management/) | Org-wide consumer ownership, Jira-authorized mitigation execution and our specific passport format were not established by this page | Specification diffing is established functionality; ANTICIPATE must connect consequences to reviewed actions. |
| Jira Service Management | Ops Expert assesses change risk using related site records; the reviewed documentation describes Premium/Enterprise availability. [Atlassian Support](https://support.atlassian.com/jira-service-management-cloud/docs/assess-potential-risks-to-your-changes-with-rovo-ops/) | No feature-absence or price-comparison claim is made for other plans/products | Do not pitch generic risk scoring or approvals as new. Explain the narrow deprecation decision and actual integrated evidence. |
| ANTICIPATE now | VERIFIED_LOCAL: labeled fixtures, graph evidence metadata, authored A/B/C comparison, explicit backend-required action review, export | No VERIFIED_FORGE simulator, authenticated approval or verified Jira outcome | Proposed differentiator remains a hypothesis until the DISCOVER → COMPARE → PREVENT → PROVE loop works against CORE. |

## Distinct value hypothesis

The proposed value is one evidence-linked decision record spanning alternatives, uncertainty, scoped approvals and actual outcomes. Neither the graph nor policy checks alone are claimed novel. Current local results demonstrate interaction quality and honest uncertainty handling; they do not prove differentiation, incident prevention or commercial value.

## Measurement plan and current internal evidence

- Fixed AUTH-142 fixtures contain five dependencies: three CONFIRMED, one INFERRED, one UNKNOWN. Authored alternatives report 3/1/0 violations, not real simulator findings or incidents prevented.
- Bounded graph behavior is tested on 120/1,000 synthetic nodes. Model-only baseline and browser search samples are in evidence/experience/v2-graph/ and v2-reliability/. They are internal measurements, not customer impact.
- Duplicate-write prevention is a backend requirement. Current UI suppresses repeated execution requests, but no real duplicate Jira writes have been tested or prevented.
- Time-to-identify dependencies, user comprehension, setup steps on a clean Jira site and willingness-to-pay remain unmeasured. Do not put invented percentage savings in the submission.

Suggested moderated validation: ask a release/platform lead to find confirmed consumers and the unknown support owner, explain why scenario C is conditional, review an individual action, and interpret a partial failure. Record completion time, mistakes and evidence confusion on a fixed task, with consent. Do not contact users automatically.

## Pricing hypotheses, not an offer

H1: a site-based subscription may match Jira procurement better than charging each reviewer. H2: read-only discovery could be a low-friction entry, with a paid decision/execution workflow only once it exists and its value is validated. H3: teams may prefer usage tied to analyzed changes, but approval predictability and audit retention need validation before metering.

No pricing, billing, paid account or subscription is implemented. Do not advertise plans, guaranteed ROI or customer testimonials. Secondary use cases and monetization UI are deferred until the real P0 flow is tested.
