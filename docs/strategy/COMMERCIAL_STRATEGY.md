# Commercial strategy — pricing hypotheses, unit economics, Marketplace readiness

Status: **hypotheses**, 4 Nov 2026. No customer interviews, pilots or willingness-to-pay data exist yet; nothing below is market validation. Buyer personas live in [BUYER_HYPOTHESES.md](BUYER_HYPOTHESES.md); competitors in [COMPETITIVE_LANDSCAPE.md](COMPETITIVE_LANDSCAPE.md). Platform facts are cited; everything else is labelled as an assumption.

## 1. What is sold

ANTICIPATE sells **a verified decision lifecycle for consequential Jira changes**, not a dependency viewer:
evidence (Confirmed / Inferred / Unknown) → deterministic alternatives → policy verdict → human approval → verified Jira writes → Prevention Passport → workflow gate and Decision Radar.
The paid value is the *control* part (approval, verified execution, gate, Passport, portfolio collisions); the read-only analysis is the adoption hook.

## 2. Platform facts that constrain pricing (verified 4 Nov 2026)

| Fact | Source |
|---|---|
| Cloud apps "Paid via Atlassian" must use per-user tiers that **exactly match the host Jira license**; annual = 10× monthly; payment model Paid-via-Atlassian cannot be switched later | [Marketplace pricing, payment and billing](https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/) |
| Revenue share for Jira Forge apps: partner keeps **84% from 1 Apr 2026, 83% from 1 Oct 2026**; Connect apps 80% → 75% | same page; [Revenue share updates 2026](https://www.atlassian.com/blog/developer/updates-to-marketplace-revenue-share-2026) |
| Forge apps: **0% commission until $1M lifetime Forge revenue** per partner (from 1 Jan 2026) | same sources |
| Forge eligibility: Forge modules, Forge auth, Forge UI only (ANTICIPATE qualifies: no Connect modules) | [Revenue share updates 2026](https://www.atlassian.com/blog/developer/updates-to-marketplace-revenue-share-2026); `manifest.yml` |
| Forge usage billing from 1 Jan 2026, per app per month across environments: Functions 100,000 GB-s free then $0.000025/GB-s; KVS read 0.1 GB free then $0.055/GB; KVS write 0.1 GB free then $1.09/GB; logs 1 GB free then $1.005/GB | [Forge pricing, January 2026](https://www.atlassian.com/blog/developer/updates-to-forge-pricing-effective-january-2026) (check the live [Forge platform pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/) page before publishing) |

Consequence: a single per-user price ladder bound to Jira tiers is mandatory for Paid-via-Atlassian. Feature tiers ("Team / Business / Enterprise") cannot be separate Marketplace SKUs of the same app; they become either **one paid app with in-app editions gated by license + configuration**, or a free read-only app plus a paid app. Decision deferred (§6).

## 3. Unit economics (estimate from the real configuration)

Inputs from the repository and hosted evidence:
- Resolver memory: `memoryMB: 1024` (`manifest.yml`) → 1 GB per second of execution.
- Hosted invocation durations observed: ~0.2–2.1 s (EVIDENCE_PACK, 3–4 Nov).
- Assumption: one full decision journey (analyze → compare → firewall → plan → approve → execute → passport) ≈ 10–15 resolver calls ≈ **15 GB-s**.

| Item | Estimate |
|---|---|
| Journeys per month inside the free Functions allowance | 100,000 / 15 ≈ **6,600** (whole app, all installs) |
| Compute cost per journey above the allowance | 15 × $0.000025 ≈ **$0.0004** |
| KVS writes per journey (snapshot, plan, approvals, records) | assumption ≤ 200 KB → ~500 journeys per free 0.1 GB, then ≈ $0.0002 per journey |
| Radar trigger per Jira link event | ≈ 0.2–1 GB-s → negligible |

Reading: infrastructure cost is negligible against any per-user price; the real costs are support, security reviews and maintenance. **Measure** before publishing: the Developer Console "Usage and costs" dashboard after a month of dev traffic, replacing the 15 GB-s assumption.

## 4. Pricing hypotheses (to test, not decided)

Anchors to collect before choosing (not yet collected): public per-user prices of the closest Jira Cloud apps in dependency mapping, release readiness and approvals (COMPETITIVE_LANDSCAPE owns the list). No competitor price is quoted here until it is verified from its Marketplace page.

| Hypothesis | Shape | Why it might work | Risk |
|---|---|---|---|
| H1 Freemium hook | Free read-only analysis (graph, scenarios, slip, portfolio) + paid control plane (plans, verified execution, Passport, validator, radar) | Analysis drives adoption; control is what governance buyers pay for | Paid-via-Atlassian needs the whole site licensed; two listings may be needed |
| H2 Single paid app, low per-user | One listing, per-user tiers matching Jira, free ≤ 10 users if Marketplace allows it for this app | Simplest procurement; aligned with how Jira admins buy | Under-prices enterprise governance value |
| H3 Enterprise add-on | Paid app + "Paid via Vendor" enterprise agreement for shared decisions, audit export, retention controls | Captures governance value | Payment model cannot be changed later; vendor billing overhead |

Validation plan (owner + muse, before any listing):
1. 5 structured interviews per persona from BUYER_HYPOTHESES (VP Eng, platform lead, release manager) on the DEMO 2 and DEMO 3 scenarios.
2. Van Westendorp price-sensitivity questions at the end of each interview; record raw answers in `docs/strategy/research/` (no personal data).
3. A 30-day private-listing pilot on 2–3 volunteer sites with usage telemetry limited to Forge console metrics (no customer content).

## 5. Marketplace readiness checklist

| Requirement | State | Evidence / next step |
|---|---|---|
| Forge-only (higher revenue share) | READY | manifest has no Connect modules |
| Licensing in manifest (`app.licensing.enabled`) | NOT STARTED | add only when the paid model is decided; test unlicensed behaviour |
| Privacy policy + support contact (public URLs) | DRAFT | `docs/legal/` drafts; blocked distribution earlier (CORE response 2 Nov) |
| Data residency / storage disclosure | PARTIAL | app stores snapshots, plans, approvals and audit in Forge KVS; document retention (retention tests exist: `test/retention.test.ts`) |
| Security self-assessment / Cloud Fortified | NOT STARTED | needs SLA, monitoring and incident process; out of hackathon scope |
| Upgrade safety (no scope change → no re-consent) | READY | manifest unchanged since ea3ee7c; 2.35/2.36 rolled out without re-consent |
| Documentation for admins (scopes, validator setup, outage policy) | PARTIAL | README + Settings copy; needs an admin guide page |
| Pricing page and listing copy | NOT STARTED | after §4 validation |

## 6. Decisions deferred, with the reason

- **Payment model** (Paid via Atlassian vs Vendor): irreversible for Paid-via-Atlassian; decide after interviews.
- **Free tier**: Marketplace rules for free user bands must be checked on the live listing form at submission time; not assumed here.
- **Enterprise features** (shared decisions, audit export): remain release-locked until hosted two-account acceptance (#131); never priced before they are live.
