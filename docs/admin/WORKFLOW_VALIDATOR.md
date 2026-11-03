# Workflow validator and outage policy (admin guide)

The "ANTICIPATE Decision Firewall" is an optional Jira workflow validator (`jira:workflowValidator` key `anticipate-decision-firewall` in `manifest.yml`). It only acts where a Jira administrator adds it to a transition. Every statement below points to the code that implements it.

## What it checks

- **Only issues labelled `anticipate-change` are gated.** All other issues pass. (`src/validator.ts`, `decideTransition`, first line.)
- A gated issue may move only if its latest ANTICIPATE decision is a verified one:
  - the latest prevention plan is **COMPLETED**, with every approved action verified in Jira (a plan that is **INVALIDATED** or **EVIDENCE_CHANGED** is refused, `src/validator.ts:69`);
  - the option is not **BLOCKED**;
  - the change itself is not blocked by **live** Jira evidence. A "migrate first" plan does not open the gate while consumers still depend on the change in Jira;
  - the decision has not **expired** (attestations are valid **14 days**, `ATTESTATION_VALID_DAYS`);
  - the issue's dependency links have **not changed** since the plan was verified.

  Each refusal shows the reason in Jira and says how to fix it. (`decideTransition` in `src/validator.ts`.)
- No graph crawl happens during a transition: the validator reads the issue (labels and links) and one stored decision record.

## Which decision gates an issue

Decision records are stored per owner and plan (`decision:{owner}:{issue}:{plan}`, since PR #94), so one person's plan never overwrites another's record. At transition time Jira only gives the issue key, so the validator reads a per-issue copy of the **latest** decision recorded for that issue, whoever recorded it (`src/main.ts:50`, `decision:{issueKey}`). In practice: if two people run plans on the same gated issue, the most recent one decides. Coordinate on one plan per gated change.

## Invalidated plans

- **What it means.** A plan was approved, and afterwards its dependency evidence changed in Jira (a link added or removed, or an issue no longer readable). It must not be executed.
- **When it happens.** When the plan's freshness is checked (from the app or the `check-plan-freshness` Rovo/MCP tool) and the evidence differs, an **APPROVED** plan becomes **INVALIDATED**. A timeline entry "Plan invalidated: …" is added, and the decision record is updated (`src/engine/service.ts:196-201`). Other statuses are not changed by this check.
- **What users see.**
  - The plan status reads **"Invalidated · re-review"**.
  - The evidence-changed alert shows the reason and a "Rebuild snapshot" button.
  - Selecting, approving and executing actions are unavailable.
- **What the server does.**
  - Execution is refused with CONFLICT before any lease or write (`src/engine/service.ts:329`).
  - The workflow validator refuses the transition with the reason above.
  - Recovery: rebuild the snapshot, compare again and approve a new plan.
- This check changes ANTICIPATE's own plan record; it never writes to Jira.

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

## Request limits (implemented, not enabled)

The backend has a per-user, per-installation, per-operation limit of **60 requests per 60 seconds** (`DEFAULT_THROTTLE`, `src/core/throttle.ts:43`).
- **Check order.** The check runs after input validation and before the operation (`src/core/handler.ts:38`).
- **Refusal.** Over the limit, a request is refused with **RATE_LIMITED**, and `retryAfterMs` tells clients how long to wait before retrying; nothing is retried automatically.
- **Status on `main` (f02ac8f):** the limit is **not wired** into the Forge entry (`src/main.ts` passes no throttle), so no request is limited today. This section will be updated when it is enabled.

When it is enabled, the app's current RATE_LIMITED message ("Jira limited this request…", `static/hello-world/src/CoreOperationError.tsx:31`) should also cover this app-side limit.
