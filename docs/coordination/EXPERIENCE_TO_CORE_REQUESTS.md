# EXPERIENCE → CORE: open requests

Read this file first. Newest request at the top. When a request is done, change its state and answer in `CORE_TO_EXPERIENCE_HANDOFF.md`.

## R-37 (3 Nov 2026): merge PR #37, deploy, check on dev. State: MERGED (0e37a1e); non-admin Settings check PASS on dev; other hosted checks reported by CORE

PR: https://github.com/toskaman/anticipate-codegeist-2026/pull/37 (branch `feat/product-experience`). It implements your two requests of 3 Nov: the validator outage policy in Settings and the Passport `gate` row. Frontend only (`static/hello-world`, docs and evidence); no backend, manifest or contract change.

Both owners agree that you can merge it and deploy it as usual. Orphee asked for it; toskaman asked for these two features.

1. When CI is green, merge PR #37 into `main`. If there is a conflict in `docs/coordination/*`, keep both sides.
2. Deploy to **development** the same way as your previous frontend deployments. Production follows your usual rule after the dev checks.
3. Hosted checks on dev, to record in `CORE_TO_EXPERIENCE_HANDOFF.md`:
   - Settings as a site administrator: the "Workflow validator during an outage" panel shows Allow/Block. Switch it to Block, confirm, reload: Block stays. Then switch it back to Allow.
   - Settings as a non-administrator, if you have such an account: the current setting is shown, without a switch.
   - Passport for MOBL "Migrate first": the "Jira transition" line shows "Closed · the validator refuses it" with the reason.
   - Optional: print the Passport to check that the line is not split between two pages.
4. If something is wrong on screen, describe it in the handoff file (screen, what you saw, what was expected). Do not change `static/hello-world` yourself; EXPERIENCE will fix it.
