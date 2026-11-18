# Rivet Auctions — Staging Deployment Verification & Public Cutover Gates
**Recorded:** 2026-11-17 (Central) · **Stage release:** Render `srv-dbuek07f3r2c73arfps0` · **Last tested stage deploy:** `dep-dbuemf7f3r2c73arm8c0` · **STATUS: STAGING DEPLOYED, PUBLIC RELEASE NOT CLEARED**

## Confirmed live, externally reachable
| URL / test | Observation | Interpretation |
| --- | --- | --- |
| https://rivet-auctions-seller-stage-20261117.onrender.com/ | HTTP **200** | Seller-first website available on separate staging origin |
| https://rivet-auctions-seller-stage-20261117.onrender.com/buyers | HTTP **200** | Buyer-agent education route deployed (second staged release) |
| https://rivet-auctions-seller-stage-20261117.onrender.com/readyz | HTTP **200** | Preview process responds |
| `/team` | HTTP **404** | **EXPECTED SECURITY:** no private staff interface mounted on the static staging service |
| `/api/inquiries` | HTTP **404** | **EXPECTED SECURITY:** preview accepts no customer details, and no false success is possible |
| Render second deploy `dep-dbuemf7f3r2c73arm8c0` | `live` | Verified published stage release; deployment commit `19d528bfb4c22b20b0ddb989400007d87a55a21a` |
| Current GitHub PR [#14](https://github.com/roger812/rivet-auctions/pull/14) | CI Node 22 validation passed on latest changes | Tests are source QA, **not** proof of production intake |

**Environment boundary:** The Render staging service is **free**, **autoDeploy off**, **no Supabase secrets**, and **not connected to the production domain or paid advertising**. No customer data is sent or stored. The page clearly states DEVELOPMENT PREVIEW and is noindex.

## Supabase independent readback — November 17, 2026
**Project:** `rivet-auctions-development`, ref `kxcziyznpvbkgtgscdsd`, ACTIVE_HEALTHY in **Primary** account.
- Eight private tables: `rivet.contacts`, `rivet.properties`, `rivet.cases`, `rivet.inquiries`, `rivet.tasks`, `rivet.activities`, `rivet.staff_memberships`, `rivet.lead_outbox`.
- All eight have RLS **enabled**.
- Supabase security advisor returned only **4 INFO** `rls_enabled_no_policy` notices for private staff, task, activity and outbox tables; they are deny-by-default and should not be 'fixed' by public grants.
- Health advisors returned **no lints**.
- Existing real Supabase Deno-compatible rollback seller-intake proof and real HTTPS signed nonpersistent IWCO receiver are documented under [engineering #1](https://github.com/roger812/rivet-auctions/issues/1). **Node 22 from Render to actual Rivet Supabase is not yet verified**. No external customer data imported by this readback.

## Final staging redeploy & mobile quality audit
- Latest Render deployment **`dep-dbueoiu7bikc739o600g`**, commit `45cdfea3e318f23d0791603a6488bfa514c5960e`, reached **LIVE**. Static routes `/`, `/buyers`, `/favicon.svg`, and `/readyz` all externally returned HTTP **200**. No customer intake or private staff routes are mounted.
- Latest matching [Node 22 Actions run](https://github.com/roger812/rivet-auctions/actions/runs/44205175807) passed after the accessibility changes and first-party icon were committed.
- **Fresh Google PageSpeed mobile lab audit, Nov 18 00:08 UTC:** seller `performance 100`, `accessibility 100`, `best-practices 100`, `SEO 60`; buyer `performance 100`, `accessibility 100`, `best-practices 92`, `SEO 60`. Both `LCP 0.8s`, `CLS 0`, `TBT 0ms` lab values. Score changes are not proof of real-user Core Web Vitals.
- **SEO 60 is intentional in staging** because `noindex/nofollow` is still set. Do not remove it until the actual production source and legal/marketing approval are established.
- **Buyer best-practices 92 is not a clean bill of health**: PageSpeed flagged Chrome console/inspector errors without actionable file/stack detail in the provided result. Reproduce in a real browser DevTools before public cutover; do not assert fixed.

## Release gates — only real unfinished work
| Priority | Gate | Evidence required | Current status |
| --- | --- | --- | --- |
| **P0** | Live customer intake | Private scoped Rivet backend with verified TLS DB URL and protected role, real server-side bot check and IP throttling, idempotent 201 receipt, 200 replay/409 conflict/503 failure tests, end-to-end saved record with cleanup of fictional fixtures | **BLOCKED**: protected backend connection + human challenge adapter/secret not configured; static preview intentionally no form |
| **P0** | Human response | Named operator and channel, private staff session/membership, authorized real inquiry review, founder alert and human response + unavailable/off-switch rollback | **BLOCKED**: real Rivet staff auth, CRM and notification integration not deployed |
| **P0** | Actual `rivetauctions.com` publisher | Owner-authorized edit access to existing ChatGPT Sites experience, or verified domain/DNS control and reconciled apex/`www` records; preserve private `/team` and existing production site until cutover | **BLOCKED**: connected Browser tool returned `Browser access requires originating browser context` in Chat mode, and no DNS-management connector is confirmed |
| **P0** | Contract and operating truth | Founder-directed Rivet Auctions agreement first → Rivet Real Estate partnership → separate listing agreement at same table; responsible licensed-party and Texas counsel approval before actual agreement use; fees/buyer premium/MLS rules checked | **DEFERRED BY FOUNDER FOR DESIGN; REQUIRED BEFORE LIVE AUCTIONS OR CONTRACTS**. [#11](https://github.com/roger812/rivet-auctions/issues/11) |
| **P1** | Buyer's actual property path | Live approved property and signed listing rules; buyer/agent offer submission and authorized verified status communications | **NOT LIVE**: education page only; no buyer/bid collection |
| **P1** | Advertising GO | Approved final landing destination, actual conversions, matched creative, disclosures, source tagging, approved budget, responder coverage | **HOLD**; current public domain is not this staging deployment. [#4](https://github.com/roger812/rivet-auctions/issues/4) |
| **P1** | IWCO CRM tagged cross-brand metadata handoff | Actual durable, signed, scoped receiver and authorized staff index; no business PII bleed | **NOT LIVE**, separate outbox/receiver draft PRs; no IWCO production changes |

### Release sequence from here
1. **Do not redirect the domain or spend yet.** Protect the already functioning live site and IWCO work.
2. Establish Render **separate secure Rivet API runtime**, backed by Rivet-only Supabase credentials installed through protected service settings, trustworthy certificate and human-verification credential—not through GitHub or chat. Complete fail-closed tests and hosted Node-to-DB verification.
3. Provision separately authorized staff access and human notifications; prove a fictional request stored in Rivet CRM, visible only to authenticated proper staff, with a response route and rollback. Do not manufacture real leads.
4. Reconcile control of actual live publisher and apex/`www`; then connect a production-ready domain only after final assets, broker/auction attribution and actual customer journey check.
5. Complete independent approved brokerage/auction contracting and truthful fee/offer rules before running real property auctions. Do not conflate collecting an inquiry with signing an auction agreement.
6. Run last mobile, desktop, accessibility, privacy, performance, and ad-to-lead smoke checks; Nathan's GO/HOLD and founder's campaign activation authority documented.

### Irreducible user/account-dependent inputs for production
- **Secure Rivet DB connection credential and project-approved CA**, set directly in protected runtime; no way to reconstruct it from the Supabase publishable key, and do not solicit it in chat.
- **Human verification provider setup** (e.g. Cloudflare Turnstile public key + protected secret), plus trusted rate limiting.
- **Rivet staff identities/authorization and approved responder**, integrated into a real notification/contact workflow.
- **Owner-confirmed actual domain/publisher access** to replace current live website or update DNS, which cannot be safely inferred from GitHub access.
- **Actual signed fee/auction/listing terms** for transactional auctions; this is a future counsel gate as requested.

### Safety record
No DNS changes, customer messages, ad activation, fee charging, public bid postings, IWCO production database changes, or unauthorized staff access occurred. The stage Render service was created and deployed and is externally reachable but clearly marked a no-data preview. Do not represent the completed staging deployment as public lead-generation launch.
