# Verified requirements — EXPERIENCE

Reviewed 2026-11-02. This log distinguishes official documentation from local implementation and unverified statements. It does not certify a deployment or contest eligibility.

## Competition

[Codegeist overview](https://codegeist2026.devpost.com/) and [official rules](https://codegeist2026.devpost.com/rules): submissions need a working Forge app with an actual Atlassian integration, judge-installable access and setup instructions. Submission materials must be English or translated. The public YouTube demo should be under five minutes; judges need not watch beyond three. Technology, design, impact, innovation and presentation are equally weighted. Deadline: 22 December 2026, noon Pacific (21:00 Paris/Amsterdam). Bonus claims require corresponding real modules/integrations; coding-assistant use is not a substitute. Current local prototype has no VERIFIED_FORGE or bonus evidence.

## Forge resource and access

[Custom UI Jira tutorial](https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/): bundle frontend assets for the manifest resource; Bridge handles supported frontend/backend interactions. Existing resource remains static/hello-world/build. Building locally is not proof of iframe/CSP/authentication compatibility.

[Global full page](https://developer.atlassian.com/platform/forge/manifest-reference/modules/global-full-page/): Preview module; requires an Atlassian app marked required in compatibility and installation on a compatible site. Documented access is {site}/apps/full-page/{installation-id}/{route-prefix}/{app-route}. Existing routePrefix is hello-world. Site, installation UUID and an actual working URL are still missing. No automatic Apps-menu placement is assumed.

[Jira full-page guidance](https://developer.atlassian.com/platform/forge/jira-full-page-modules/) and [routing tutorial](https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/) were consulted. They do not validate our hash-based local routes in Forge. The prompt's specific historical claim about legacy module removal was not independently established from the retrieved text; do not use it to justify a manifest migration. Do not conflate global:fullPage Preview with global:ui EAP. CORE owns any module change.

## Bridge and theming

[Bridge overview](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/bridge/): use the bundled @forge/bridge APIs within the supported host context. Our production code loads Bridge lazily and handles local-host unavailability.

[invoke reference](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/invoke/): calls require actual resolver definitions. Shared TypeScript types improve development checks but are not authorization or runtime security. Our resolver bindings are deliberately empty until CORE publishes them. Runtime schema validation remains required. A client timeout/abort stops observation, not a committed backend write.

[Design tokens and theming](https://developer.atlassian.com/platform/forge/design-tokens-and-theming/): view.theme.enable() opts Custom UI into host theming and reactive theme changes. The production access UI invokes it with an observer and safe local fallback. Hosted behavior and token mapping remain unverified. [Atlassian Design](https://atlassian.design/) was reviewed as design guidance, not as assets to copy or a conformance certificate.

## Distribution and Marketplace

[Distribution documentation](https://developer.atlassian.com/platform/forge/distribute-your-apps/): contributor-only access differs from external sharing; site admins install through an owner-generated installation link. Sharing has owner-controlled setup and deployment prerequisites. Marketplace/licensing can affect sharing-link availability. CORE must decide distribution strategy; EXPERIENCE must not create a second registration or invent a judge link.

[Atlassian Marketplace](https://marketplace.atlassian.com/) was consulted for the listing context. Listing copy/assets, competition evidence and product-runtime bonus integrations are separate deliverables. No listing, production deployment, public video, acceptance of terms or submission was performed.

## Open evidence gates

- Reviewed shared schema/version and resolver bindings from CORE.
- Actual installation/site/deep link and permitted test account.
- Hosted Bridge, CSP, routing, theme and permission checks.
- Real Jira-backed simulations, per-action approvals, verified/partial/failed execution and retry-safe status lookup.
- Clean-site judge installation and actual video matching those verified features.
