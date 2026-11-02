# Frontend dependency follow-up — 2026-11-02

This is dependency evidence, not a production security clearance. The initial investigation below describes the deployed baseline; the verified frontend override follow-up supersedes its unchanged-lockfile state.

## Verified frontend override follow-up

The frontend now scopes npm overrides under `@forge/bridge` to `prosemirror-view@1.42.9` and `prosemirror-model@1.25.12`. The model patch satisfies the new view dependency while keeping a single model instance throughout the Forge subtree. Forge Bridge itself, backend packages, contracts and manifest are unchanged. These overrides intentionally supersede Atlaskit's exact transitive pins; they are not an Atlassian compatibility certification.

After clean `npm ci --ignore-scripts`, full audit reports **16 affected dependency entries: 14 moderate / 2 high**, down from 20 (13 moderate / 7 high). Production-only audit reports **6 entries: 4 moderate / 2 high**, down from 10 (3 moderate / 7 high). ProseMirror's advisory is no longer present; Forge Bridge is still affected at moderate severity through its manifest dependencies. These are dependency-entry counts, not independent exploit counts. Shared Zod 3 and glob/minimatch advisories remain unresolved.

TypeScript, lint, formatting, **42 unit tests**, **51 browser tests (39.0 s)** and build passed after clean install. Notices were regenerated for the two changed package versions and the final build passed again. Inventory remains 24 direct packages, 162 runtime paths and 11 missing root license texts. Raw audit and current inventory: `evidence/experience/dependency-remediation/`.

The application does not expose a ProseMirror editor; its browser suite verifies the existing frontend journey, not every upstream editor behavior or malicious paste case. The emitted application JS/CSS filenames stayed unchanged, consistent with the editor code being excluded by the existing build; this is not a general reachability proof. Dependency installation is remediated for this advisory, without claiming a measured runtime security change. Hosted Forge compatibility has not been independently tested. No deployment was performed; CORE owns deployment decisions. Remove the overrides when the upstream Bridge tree resolves to patched compatible versions, with the same checks before publication.

## Measured audit

From `static/hello-world`, `npm audit --omit=dev --json` returned exit 1 with **10 affected dependency entries: 3 moderate, 7 high, 0 critical**. These counts include parent packages affected through a shared dependency; they are not ten independent exploits. The full audit still reports **20 entries: 13 moderate, 7 high**. The production-only view must not replace the full audit count in release reporting.

## Why the obvious update did not fix the finding

`npm ls prosemirror-view glob minimatch` identifies this chain:

`@forge/bridge@7.2.1-next.13` → `@atlaskit/adf-schema@56.7.3` → `@atlaskit/editor-prosemirror@8.0.3` / `9.0.0` → `prosemirror-view@1.41.5`.

Both editor package manifests pin **exactly 1.41.5**, confirmed with `npm view <package>@<version> dependencies.prosemirror-view`. The [upstream advisory](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w) identifies versions below 1.42.3 as affected by XSS when pasting attacker-provided HTML into an editor; the registry currently offers 1.42.9. `npm update prosemirror-view --ignore-scripts` completed successfully but reported “up to date” and made **no tracked change**. It did not remediate the advisory. Application exploitability or absence of exploitability was not demonstrated.

The audit suggests changing Forge bridge to 5.5.0, a major downgrade from the installed prerelease. Do not interpret that automated suggestion as host compatibility proof. A bridge migration or a narrowly scoped override requires separate compatibility review, clean install, full frontend checks and authenticated Forge read-only smoke before deployment by CORE.

Other affected runtime entries include `glob@13.0.6` / `minimatch@10.2.6` through Forge manifest dependencies and Zod 3 through the local shared contracts package. Shared contracts and backend dependency remediation remain CORE-owned; frontend payload bounds do not remediate their advisory.

## Next useful gate

CORE should assess the shared Zod remediation and bridge compatibility alongside the existing release findings. EXPERIENCE can test an agreed bridge/override candidate locally. Keep the pinned deployment candidate until that candidate has actual verification; do not use `npm audit fix --force` as a deployment decision. No Forge deployment, scope change, Jira mutation or credential access was performed for this audit.

CORE follow-up `745fe69` records hackathon risk acceptance and defers the shared Zod 4 migration. Its reference to schema `.max()` bounds must not be interpreted as a demonstrated fix: this advisory specifically concerns oversized constrained collections. Frontend preflight bounds and Forge transport limits are distinct controls; backend mitigation effectiveness has not been established by EXPERIENCE. The advisory remains open despite that recorded release decision.
