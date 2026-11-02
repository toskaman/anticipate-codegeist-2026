# Bootstrap (Windows owner PC, PowerShell)

```powershell
$env:Path = "E:\Codegeist2026\tools\node-v24.22.1-win-x64;E:\Codegeist2026\tools\forge-cli;$env:Path"
$env:npm_config_cache = "E:\Codegeist2026\.cache\npm"
npm install -g @forge/cli --prefix E:\Codegeist2026\tools\forge-cli
forge login            # NEW token from id.atlassian.com; never paste it in files/chat
forge whoami

cd E:\Codegeist2026\ANTICIPATE-CORE
npm install            # root: Forge backend deps + vitest/typescript
npm run typecheck
npm test               # backend 12 tests
npx vitest run --root packages/contracts
npx vitest run --root packages/simulation-core
cd static\hello-world; npm install; npm run build; cd ..\..
forge lint
forge deploy -e development
forge install -e development     # choose the dev Jira site; accept the new scopes
forge install list               # note the installation id
```
Open: `https://<site>.atlassian.net/apps/full-page/<installation-id>/hello-world/`
Scopes changed (read/write:jira-work, read:jira-user, storage:app) → existing installs need `forge install --upgrade`.
