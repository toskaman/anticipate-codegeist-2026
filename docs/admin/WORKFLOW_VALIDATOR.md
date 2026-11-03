# Workflow validator and outage policy (admin guide)

The "ANTICIPATE Decision Firewall" is an optional Jira workflow validator (`jira:workflowValidator` key `anticipate-decision-firewall` in `manifest.yml`). It only acts where a Jira administrator adds it to a transition. Every statement below points to the code that implements it.

## What it checks

- **Only issues labelled `anticipate-change` are gated.** All other issues pass. (`src/validator.ts`, `decideTransition`, first line.)
- A gated issue may move only if its latest ANTICIPATE decision is a verified one:
  - the latest prevention plan is **COMPLETED**, with every approved action verified in Jira;
  - the option is not **BLOCKED**;
  - the change itself is not blocked by **live** Jira evidence. A "migrate first" plan does not open the gate while consumers still depend on the change in Jira;
  - the decision has not **expired** (attestations are valid **14 days**, `ATTESTATION_VALID_DAYS`);
  - the issue's dependency links have **not changed** since the plan was verified.

  Each refusal shows the reason in Jira and says how to fix it. (`decideTransition` in `src/validator.ts`.)
- No graph crawl happens during a transition: the validator reads the issue (labels and links) and one stored decision record.

## Outage policy: what happens if ANTICIPATE cannot verify

An **outage** is any failure to read the issue or the decision while the transition runs. That includes:
- an exception;
- an issue the app cannot read (403/404);
- a transition without an issue key.

(`runValidator` in `src/validator.ts`; `validateTransition` in `src/main.ts`.)

| Policy | Behaviour during an outage | Default |
| --- | --- | --- |
| **Allow** | The transition passes and the degradation is logged (`outage: true` in the app logs). ANTICIPATE being down never stops a team's workflow, but gated changes are not checked during that time. | **Yes** |
| **Block** | The transition is refused with a message that names the outage and the recovery path: try again in a few minutes, or ask a Jira administrator to switch to Allow. Gated changes stay protected, but those transitions stop while ANTICIPATE is unavailable. | No (opt-in) |

Safety net: if even the policy cannot be read, **Allow** applies, so a storage outage can never lock every gated workflow (`runValidator`, policy read wrapped in `try`).

The policy only matters during an outage. When ANTICIPATE can read Jira, the normal checks above apply whatever the policy.

## How to change it

1. Open ANTICIPATE → **Settings** → panel **"Workflow validator during an outage"**.
2. Everyone sees the current setting and when it was changed.
3. Only **Jira site administrators** (global permission `ADMINISTER`) see the Allow / Block switch. A confirmation explains the trade-off, and nothing is saved on Cancel.
4. The backend re-checks `ADMINISTER` on every change and refuses others with `PERMISSION_DENIED`. Hiding the switch is only a convenience, not the security boundary. (`getValidatorPolicy` / `setValidatorPolicy` in `src/engine/service.ts`.)

The setting applies to every workflow on the site that uses the validator. It changes no Jira issue.

## Add or remove the validator

- **Add:** Project settings → Workflows → edit a test workflow → add the rule "ANTICIPATE Decision Firewall" to a transition → publish. Try it first on a test project.
- **Remove:** delete the rule from the transition in the workflow editor. Nothing else needs cleaning up.

## Implications to weigh

- **Allow (default)** favours availability. An outage window is a window without enforcement; check the app logs for `outage: true` if you need to audit it.
- **Block** favours control. Plan for gated transitions to wait while ANTICIPATE or Jira is unreachable, and keep a site administrator reachable to switch back to Allow.
- In both cases the validator never writes to Jira and never approves anything on its own.

Hosted verification of these behaviours is recorded in [EVIDENCE_PACK.md](../evidence/EVIDENCE_PACK.md):
- admin Allow → Block → Allow;
- Cancel;
- non-admin read-only view;
- validator refusal under Block;
- judge-site validator run.
