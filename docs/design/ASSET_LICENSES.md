# Dependencies, assets and rights inventory

Status: inventory completed locally; release clearance not claimed. Run npm run licenses:inventory in static/hello-world to regenerate evidence/experience/v2-research/license-inventory-LOCAL.json and public/THIRD_PARTY_NOTICES.txt. The inventory records the package-lock SHA-256 so it can be tied to the installed dependency set.

## Installed direct runtime packages

| Package | Installed version | Manifest license / finding |
|---|---|---|
| @forge/bridge | 7.2.1-next.13 | SEE LICENSE IN LICENSE.txt; file refers to Atlassian Developer Terms. Owner review required; not treated as MIT/OSI and no new terms were accepted by this inventory. |
| @xyflow/react | 12.12.0 | MIT; preserve bundled notices and visible React Flow attribution. |
| lucide-react | 1.66.0 | ISC declaration; full license file includes additional attribution text, retained in generated notices. |
| react / react-dom | 18.3.1 | MIT notices retained. |
| zod | 4.6.7 | MIT notices retained. |

The machine-readable inventory covers all 23 direct dependencies, including tooling, and 160 available non-dev package paths. Tool licenses include MIT, Apache-2.0 and MPL-2.0; exact installed declarations are in the inventory. The generated notices retain the complete available root license/notice files, not just SPDX labels. This is inventory evidence, not a legal opinion or guarantee of compliance.

Ten installed runtime paths (including duplicate nested packages) had no root license text discovered by the script: @atlaskit/adf-schema-generator, @atlaskit/platform-feature-flags, @statsig/client-core, boolbase, css-color-names, iframe-resizer, jsesc and punycode.js. Review package subdirectories/upstream distribution before release. A missing discovered file does not establish that a package is unlicensed. The scan is intentionally reported as incomplete rather than silently clearing these paths.

## Product assets

UI is code-authored CSS/HTML/React. Icons come from lucide-react; no competitor logos, downloaded stock imagery, external font/CDN, music or video were added. Segoe UI is referenced as an installed system font and is not bundled. Screenshots are captures of the running local application, explicitly MOCK/LOCAL. Brand text/shield treatment is not a trademark clearance claim. Future video, banner, logo and Marketplace assets need their own rights review.

## Release gates

- Keep third-party notices with distributed code; verify the final built artifact and all subdependency requirements.
- Owner reviews applicable Forge terms and any eventual Marketplace/media terms; the agent does not accept them.
- Resolve or document missing license texts and outstanding dependency audit findings.
- No private Jira/Confluence content, credentials or unapproved personal information should be included in public screenshots or videos.
- No public listing, video, legal acceptance, paid service or submission was performed in this workstream.
