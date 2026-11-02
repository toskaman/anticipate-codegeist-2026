# Verified rules & APIs

| Source | Accessed | Finding |
|---|---|---|
| https://codegeist2026.devpost.com/rules | 2026-11-02 | Deadline 2026-12-22 12:00 PT. Forge app + ≥1 of Jira/Confluence/JSM/Bitbucket/Teamwork Graph/Rovo; built/updated after 2026-10-27; manifest + ≥1 module; install link per Atlassian sharing instructions; public YouTube < 5 min (3 min watched), no unlicensed music/trademarks; text description; detailed testing instructions; English; one category. Stage 1 pass/fail, Stage 2 five equal criteria. Bonus ($1,500 ×6 each): rovo:agent/agentConnector/skill/action; rovo:mcp; Teamwork Graph; Marketplace listing or review ticket. |
| https://developer.atlassian.com/platform/forge/manifest-reference/modules/global-full-page/ | 2026-11-02 | Preview; AGC unsupported; `routePrefix` required; URL `{site}/apps/full-page/{installation-id}/{routePrefix}/{route}`; no Apps-menu entry documented. |
| https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/ | 2026-11-02 | Preview; max 1 per app; tools = `action` keys (≤50); external exposure disabled until admin enables; clients connect at `https://mcp.atlassian.com/forge/<appId>` with OAuth 2.1; invoking user's permissions apply. |
| https://developer.atlassian.com/platform/forge/design-tokens-and-theming/ | 2026-11-02 | `view.theme.enable()`, `html[data-color-mode]`. |
| npm `@forge/kvs` 2.1.1 (typings) | 2026-11-02 | `kvs.get/set/delete`, `set(..., { keyPolicy: 'FAIL_IF_EXISTS' })` used for atomic claims. |
| npm `@forge/cli` 15.0.0 | 2026-11-02 | `forge lint` requires an authenticated user. |

Assumptions not yet verified on a real site: Jira `POST /rest/api/3/search/jql` response shape (`issues`, `nextPageToken`), `project/search?expand=insight` issue counts, `mypermissions` scope (`read:jira-user` added defensively), KVS `FAIL_IF_EXISTS` error type.
