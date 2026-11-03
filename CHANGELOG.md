# Changelog

All notable changes to ANTICIPATE, written for readers who use or judge the app. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every entry links the merged pull request it comes from; nothing here goes beyond what those PRs contain. Deployed versions and test counts live in [docs/RELEASE.md](docs/RELEASE.md).

## [Unreleased]

Changes merged after the last recorded production deployment (production 2.30.0 from `main` d995021, see [docs/evidence/EVIDENCE_PACK.md](docs/evidence/EVIDENCE_PACK.md)) are listed under 3 November below until the next deployment is recorded.

## 3 November 2026

### Added

- **What if it slips?** Delay an issue by 1–365 days and see which due dates move along the "blocks" chain, which releases become late and what cannot be assessed. Available as a Scenario Lab panel and as a Rovo/MCP action ([#59](https://github.com/toskaman/anticipate-codegeist-2026/pull/59), [#61](https://github.com/toskaman/anticipate-codegeist-2026/pull/61)). Empty, error, unknown and loading states with clear messages ([#70](https://github.com/toskaman/anticipate-codegeist-2026/pull/70)).
- **Validator outage policy.** Jira site administrators choose whether gated transitions are allowed (default) or blocked when ANTICIPATE cannot verify them; other users see the setting read-only ([#31](https://github.com/toskaman/anticipate-codegeist-2026/pull/31), [#37](https://github.com/toskaman/anticipate-codegeist-2026/pull/37)). Unreadable issues (403/404) follow the same policy ([#38](https://github.com/toskaman/anticipate-codegeist-2026/pull/38)).
- **Jira transition status in the Passport.** The Passport shows whether the workflow validator would currently allow the transition, separately from the recorded outcome ([#34](https://github.com/toskaman/anticipate-codegeist-2026/pull/34), [#37](https://github.com/toskaman/anticipate-codegeist-2026/pull/37)), and opens with an "In short" summary ([#39](https://github.com/toskaman/anticipate-codegeist-2026/pull/39)).
- **Invalidated plans.** An approved plan whose evidence changed is marked "Invalidated · re-review" and cannot be approved or executed ([#94](https://github.com/toskaman/anticipate-codegeist-2026/pull/94)). Regression tests cover the latest invalidation notice and the real workflow hook, including zero approval/execution requests and an APPROVED control ([#102](https://github.com/toskaman/anticipate-codegeist-2026/pull/102), [#110](https://github.com/toskaman/anticipate-codegeist-2026/pull/110)).
- Shared decision workspace: backend prototype only, not exposed in the app ([#46](https://github.com/toskaman/anticipate-codegeist-2026/pull/46)).

### Changed

- "Migrate first" is labelled as a simulation assumption, and a passing result is described as not authorizing the Jira transition ([#39](https://github.com/toskaman/anticipate-codegeist-2026/pull/39)).
- Faster cold start: Forge function memory raised to 1024 MB ([#63](https://github.com/toskaman/anticipate-codegeist-2026/pull/63)); measured first-open timings are in the evidence pack ([#75](https://github.com/toskaman/anticipate-codegeist-2026/pull/75)).
- Dependency crawls fetch up to 5 Jira issues in parallel, within the same limits ([#86](https://github.com/toskaman/anticipate-codegeist-2026/pull/86)).
- Decision records used by the validator are stored per owner and plan ([#94](https://github.com/toskaman/anticipate-codegeist-2026/pull/94)).
- Clearer message when a plan belongs to someone else ("private to its creator") instead of a Jira-permission hint ([#45](https://github.com/toskaman/anticipate-codegeist-2026/pull/45)).

### Fixed

- A plan that only _assumes_ a migration can no longer open the Jira workflow gate (R17) ([#33](https://github.com/toskaman/anticipate-codegeist-2026/pull/33)).
- A transition without an issue key follows the outage policy instead of passing silently ([#54](https://github.com/toskaman/anticipate-codegeist-2026/pull/54)).
- Passport print: evidence counts stay on one row ([#45](https://github.com/toskaman/anticipate-codegeist-2026/pull/45)); tags keep their contrast when printing with the dark theme ([#60](https://github.com/toskaman/anticipate-codegeist-2026/pull/60)).
- Settings and Passport accessibility pass: no axe violations, keyboard-only confirmation dialog ([#60](https://github.com/toskaman/anticipate-codegeist-2026/pull/60)).
- Error screens show the request ID and offer a retry ([#84](https://github.com/toskaman/anticipate-codegeist-2026/pull/84)).

### Security

- Per-user, per-operation request limits are wired into the Forge resolvers. Rate-limited errors ask users to wait before retrying manually, rather than suggesting a Jira permission change ([#109](https://github.com/toskaman/anticipate-codegeist-2026/pull/109)).
- zod 4 migration (advisory GHSA-mrhx-c7xc-m3w5 remediated) ([#35](https://github.com/toskaman/anticipate-codegeist-2026/pull/35)).
- Development-only diagnostics endpoints removed from the app entry and guarded by a test ([#84](https://github.com/toskaman/anticipate-codegeist-2026/pull/84)).
- CI runs a security audit, frontend checks and Playwright on every pull request ([#41](https://github.com/toskaman/anticipate-codegeist-2026/pull/41)), plus backend ESLint ([#98](https://github.com/toskaman/anticipate-codegeist-2026/pull/98)).

### Verified on hosted sites

- Clean-site judge run in production from the public install link ([#43](https://github.com/toskaman/anticipate-codegeist-2026/pull/43)), and the workflow validator on that site ([#46](https://github.com/toskaman/anticipate-codegeist-2026/pull/46)).
- Passport printed to PDF on the development site ([#44](https://github.com/toskaman/anticipate-codegeist-2026/pull/44)).
- Teamwork Graph attempt blocked by Atlassian allowlisting, with evidence ([#40](https://github.com/toskaman/anticipate-codegeist-2026/pull/40)).

### Documentation

- Updated invalidation and MCP safety wording ([#103](https://github.com/toskaman/anticipate-codegeist-2026/pull/103)), rechecked the final submission text ([#111](https://github.com/toskaman/anticipate-codegeist-2026/pull/111)), added a five-minute judge walkthrough ([#112](https://github.com/toskaman/anticipate-codegeist-2026/pull/112)), refreshed test counts ([#114](https://github.com/toskaman/anticipate-codegeist-2026/pull/114)), and documented bridge HMAC activation, signing, rotation and owner acceptance. Live bridge activation remains unverified by this session ([#115](https://github.com/toskaman/anticipate-codegeist-2026/pull/115), [#118](https://github.com/toskaman/anticipate-codegeist-2026/pull/118)).
- Final Devpost text, video script, submission checklist and gallery diagrams ([#56](https://github.com/toskaman/anticipate-codegeist-2026/pull/56), [#57](https://github.com/toskaman/anticipate-codegeist-2026/pull/57), [#72](https://github.com/toskaman/anticipate-codegeist-2026/pull/72), [#83](https://github.com/toskaman/anticipate-codegeist-2026/pull/83)).
- Judge-facing README ([#69](https://github.com/toskaman/anticipate-codegeist-2026/pull/69)), workflow validator admin guide ([#81](https://github.com/toskaman/anticipate-codegeist-2026/pull/81)), single source for versions and test counts ([#82](https://github.com/toskaman/anticipate-codegeist-2026/pull/82)).

## 2 November 2026

### Added

- Dependency upgrade comparisons: breaking upgrade, backward-compatible shim, move consumers first ([#13](https://github.com/toskaman/anticipate-codegeist-2026/pull/13), [#19](https://github.com/toskaman/anticipate-codegeist-2026/pull/19)).
- Decision attestations for the workflow validator, Passport retention and historical records ([#18](https://github.com/toskaman/anticipate-codegeist-2026/pull/18)).
- Guided demo entry point and a Display & accessibility menu ([#17](https://github.com/toskaman/anticipate-codegeist-2026/pull/17)); dark theme by default ([#25](https://github.com/toskaman/anticipate-codegeist-2026/pull/25)).
- Evidence sources strip, A4 Passport print and session timings ([#19](https://github.com/toskaman/anticipate-codegeist-2026/pull/19)).

### Fixed

- Partial approval can no longer pass the Decision Firewall as a completed decision ([#26](https://github.com/toskaman/anticipate-codegeist-2026/pull/26)).
- Slow first-time sample creation re-checks Jira instead of showing TIMEOUT ([#16](https://github.com/toskaman/anticipate-codegeist-2026/pull/16)).
- Two Passport print defects seen on the hosted print ([#23](https://github.com/toskaman/anticipate-codegeist-2026/pull/23)).

### Changed

- UI v3 integrated with evidence safety preserved and the judge sample setup fixed ([#14](https://github.com/toskaman/anticipate-codegeist-2026/pull/14)); light-theme test coverage, clearer demo path, README and Devpost ([#27](https://github.com/toskaman/anticipate-codegeist-2026/pull/27)).

### Legal

- Proprietary, source-available licence with joint 50/50 copyright ([#22](https://github.com/toskaman/anticipate-codegeist-2026/pull/22), [#24](https://github.com/toskaman/anticipate-codegeist-2026/pull/24)).

Earlier work (before PR #12) is not itemised here; see the git history.
