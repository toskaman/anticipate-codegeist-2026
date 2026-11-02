# jira:workflowValidator — research note (not implemented)

Goal: optionally block a Jira transition (e.g. "Done" on an `anticipate-change` issue) when the latest ANTICIPATE simulation is BLOCKED.

Plan (only after P0 end-to-end works, on an isolated test workflow, with rollback):
1. Add a `jira:workflowValidator` module whose function reads the latest stored comparison for the issue (KVS key by issue) — no live crawl inside the validator (latency limits).
2. Fail closed only for issues explicitly labelled `anticipate-change`; everything else passes.
3. Missing/expired snapshot → pass with a warning (never block on our own outage), documented.
4. Rollback = remove the validator from the test workflow; the module is inert elsewhere.

Status: DEFERRED. Must be verified against current Forge docs and a real test workflow before claiming it.
