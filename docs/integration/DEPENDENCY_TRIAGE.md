# Frontend dependency follow-up — 2026-11-02

This is dependency evidence, not a production security clearance. Runtime source and lockfile remain unchanged from candidate `4c68d90`.

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
