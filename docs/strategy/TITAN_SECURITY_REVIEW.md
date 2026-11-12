# TITAN security + reliability review (12 Nov 2026, main 4ea8593)

Scope: backend resolver surface, Jira adapters, storage, validator policy,
workspace wiring, frontend call pattern. Method: direct code reading
(no DAST; hosted behavior covered by existing HOSTED_ACCEPTANCE + EVIDENCE_PACK).

## Files inspected

- `src/core/handler.ts` (whole wrapper), `src/main.ts` (ops wiring),
  `src/forge-adapters.ts` (whole), `src/workspace/forge.ts` (whole),
  `src/engine/service.ts` (validator policy ops), frontend
  `static/hello-world/src` (call-pattern grep).

## Result: PASS, no P0/P1. Verified controls

- Input: 64KB hard payload bound BEFORE schema validation (zod-3 GHSA
  mitigation), zod `safeParse` on input AND output contracts per op.
- Errors redacted: generic INTERNAL to callers; logs carry no payloads,
  tokens, or Jira content.
- Throttle on every resolver op, checked after validation (bad payloads
  never consume budget).
- AuthZ: all Jira calls `asUser()` by default (Jira enforces caller
  perms); `asApp()` confined to the validator label/decision lookup, the
  permission-search helper, and the Radar trigger (which makes no Jira
  call). Cross-account permission checks fail closed.
- Validator outage policy readable by all, editable only with global
  ADMINISTER + authenticated user (`service.ts`).
- Storage: TTL retention on every KVS prefix except admin config;
  `setIfAbsent` for locks; prefix queries clamped to ≤100.
- Injection: ADF builder escapes text (never markup); planId allowlist
  regex; no `eval`/innerHTML patterns in backend.
- Reliability: GET-only single retry on 429/5xx; mutations never
  auto-retried; typed retryable errors surfaced to UI.
- Frontend: zero direct Jira calls (no requestJira/asUser/asApp/fetch
  in frontend src) — everything via resolvers. No secrets in code;
  4 minimal manifest scopes (verified at freeze).

## Non-blocking notes

- `createSampleProject` lets any installed-site user write 6 demo
  issues + 4 links: by design (judge demo), throttled, labelled,
  manually deletable. Reviewed-OK.
- KVS test-double fidelity residual (charset edge noted in wave-1
  audit): P2, suggest a charset-fuzz regression test post-submission.
- Shared workspace resolvers exist but refuse with FEATURE_DISABLED
  until a hosted two-account test passes (decision D3). Correct posture.

Verdict: nothing to fix before submission on this surface.
