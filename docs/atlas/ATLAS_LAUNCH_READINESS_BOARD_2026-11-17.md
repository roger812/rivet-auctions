# Atlas Same-Day Messaging & Launch Readiness — Executive Gate Board
**November 17, 2026 · Owner: Nathan (decision) / Jordan (continuity) / Daniel (release)**
**Status:** Copy package drafted; **NOT** a blanket authorization to deploy, run ads, spend, disclose a selected premium or enroll customers.
**Goal:** End today with a coherent, reviewable creative system and the shortest verified path toward advertising without false claims or disruption to current IWCO work.

## Executive priority: two different ad clocks
1. **IWCO Google Search** — near-term Nov 18 Austin $50/day plan *previously* approved in its own workstream. Preserve existing creative/destination until fresh account/live-form proof; do not conflate with paused ChatGPT Ads pilot.
2. **Rivet Auctions ads** — **not** launch-ready because the public URL currently says PRIVATE REVIEW/email replies not connected; secure source/runtime, buyer/agent information, fee/contract terms, staff response and actual ad destination must pass. Drafting assets today is compatible with a later independently authorized paid launch.
3. **Rivet Real Estate seller messaging** — third-party live site (Luxury Presence footer) needs actual publisher editing and compliance readback. No assumption the Rivet Auctions GitHub repo deploys it.

## Assets prepared on branch (source-of-truth for review)
- [Unified Message System](./UNIFIED_SELLER_OPTIONS_MESSAGE_SYSTEM_2026-11-17.md)
- [Rivet Auctions full homepage and buyer/agent copy + FAQ + video](./RIVET_AUCTIONS_WEBSITE_COPY_2026-11-17.md)
- [Rivet Real Estate + IWCO crossbrand modules, consultation, email/social](./RIVET_REAL_ESTATE_IWCO_CROSSBRAND_ASSETS_2026-11-17.md)
- [Paid-media search/social/ChatGPT creative pack](./PAID_MEDIA_CREATIVE_PACK_2026-11-17.md)
- This evidence-based launch board.

## Documented live/read-only snapshot
| Workstream | Actual observation (2026-11-17) | What is DONE | What remains / what blocks |
| --- | --- | --- | --- |
| **Rivet Auctions homepage** | Connected browser at `https://rivetauctions.com/`: `PRIVATE REVIEW`, `Requests save to the team · Email replies not connected`, hero aimed at `homes that need work` and described a leading-offer email reply as *once live*. | Read actual page; fully drafted broader seller narrative and FAQ. | Find actual publisher; build preview; verify seller/buyer save receipts and staffed follow-up; determine rules + who controls leading-offer disclosures; resolve live fee wording; TREC/MLS/seller authorization; then remove review banner and separately approve public ads. |
| **Rivet backend + CRM** | [Rivet #1](https://github.com/roger812/rivet-auctions/issues/1): real Supabase Edge transaction proof and signed cross-project nonpersistent test passed; Node Render runtime and persistent, scoped IWCO index still unproven. PRs #2 and #3 draft, IWCO PR #130 draft. | Verified previous nonproduction proof *in issue history*, not relaunch proof. | Node22 protected DB proof, durable signed outbox/receiver, staff grants, no cross-brand PII leak, private team authorization, full end-to-end real deployment test. |
| **IWCO public site** | `https://iwantcashoffers.com/` responds with four clear homeowner paths, offers terms and testimonial attribution. | Site messaging comparatively aligned. | Optional lower-page referral copy with permission; no wholesale homepage rebuild needed. Preserve light intake. |
| **IWCO alerts** | [IWCO #160](https://github.com/roger812/iwco-development/issues/160) Nov17 comments: founder-only SendGrid alert enabled, internal Gmail receipt verified, prospective cutoff 11:35:02am Central and OFF switch rehearsed. | Verified private alert transport setup, not a genuine first homeowner cycle. | First real eligible inquiry, alert to founder, explicit acknowledgment, permitted reply, task/status, escalation/rollback observations; don't manufacture a real production lead. |
| **IWCO Google Search** | Connected Chrome tab showing enabled `IWCO | Austin | Search | Homeowner Inquiry | V1`, $50/day, `Pending`, ad strength `Poor`, 0 impressions on snapshot, **disconnection / ad blocker** banners. | Prior approved Nov18 budget/date and earlier conversion proof in [IWCO #131](https://github.com/roger812/iwco-development/issues/131). | Live signed-in readback for account eligibility, campaign status/schedule, final URL(s), site form, attribution, biller and staffing. Snapshot is stale and cannot establish what will run tomorrow. No silent changes. |
| **IWCO ChatGPT Ads** | Ads Manager read on Nov17: one standard `IWCO - Explore Home Options - Photo V1`, approved, **paused**; campaign also paused; $50/day when enabled. | Baseline reviewed; 5 copy proposals prepared. | Ads remain paused. Image approval + final write confirmation required before creating variants; separate explicit activation/spend approval. |
| **Rivet Real Estate site** | `https://rivetre.com/` public homepage has buyer-oriented main hero, seller section and actual client testimonials, licensed broker shown as `SIDE, INC.`, site powered by Luxury Presence. | New seller landing/module draft exists. | Confirm publisher/actual brokerage relationships and contact form, broker display, install revised module in CMS and independently QA. No access to third-party CMS write established in this thread. |

## Non-negotiable consumer experience and compliance acceptance
- **One clear audience & CTA per page**. Seller ad → seller page → acknowledged consultation. Agent ad → instructions for participating agents, not seller lead form.
- **Same care** cannot be marketing-only: assigned licensed broker/agent, property review, marketing plan, authorized offer process, agent communications, contingencies, transaction coordination, conflict handling, and written fee clarity. Define what is included.
- **No misleading price comparison**: a highest *price* isn't necessarily best *offer*. Disclose only approved verified/timestamped figures, property-level rules and permission. No guaranteed speed, price, multiple buyers or reserve outcome.
- **Pricing open:** buyer premium vs conventional commissions and $500 agent proposal remain options, **not final pricing**, see [#10](https://github.com/roger812/rivet-auctions/issues/10), [#11](https://github.com/roger812/rivet-auctions/issues/11). Legal can remain deferred during research and drafts but not during actual property offering/contract/ad-fee promise.
- **Brokerage ads:** TREC §535.155 requires proper license-holder and broker names; current Rivet RE footer indicates `SIDE, INC.`. Check the registered brand/sponsor before public copy; do not pretend it is independently licensed.
- **No invented social proof:** attribute Rivet reviews to Rivet; IWCO page currently identifies quotes as other companies' experiences. Do not imply prior Rivet Auction results.
- **Cross-brand privacy:** explicit informed handoff only, source and individual consent retained, no unrestricted shared customer data.
- **Fair housing:** service marketing without protected-class filtering, fear-based personal-trait inferences, neighborhood steering or misleading property urgency.
- **Real lead success:** form HTTP/save, matching CRM receipt+source+case+task, owner alert and acknowledgment, actual response and suppression; no success UI until saved. Monitor after hours and failure path.
- **Ads:** full reviewed creative, final destination, billing, targeting, campaign dates, budget, account status; NO paid launch by documentation alone.

## Decision gates (executive checks, not artificial delivery estimates)
### A. TODAY — draft creative package
- [x] Unified umbrella and brand hierarchy defined.
- [x] Rivet seller homepage, page/FAQ/CTA/buyer-agent language drafted.
- [x] Rivet Real Estate and IWCO crossbrand insertions and scripts drafted.
- [x] Google Search/ChatGPT/social/video **copy** drafted; keyword ideas only, no performance claims.
- [x] Fee-neutral copy and TREC broker-name flag documented.
- [x] Work branch created; original web/code/prod branches unchanged.
- [ ] Priyanka/Marcus-style challenge review of the message alternatives; role-simulated judgments can be documented but no real employee review presumed.
- [ ] Approved/licensed photo and footage selected, edited and checked for brand fit.
- [ ] Final approved fee / agent / reserve / premium explanation for real transactions (separate legal gate).
### B. IWCO — before Nov 18 Search delivery
- [ ] Verify signed-in Google campaign live state, final URLs/tracking, billing and eligibility (disconnected browser snapshot not authoritative).
- [ ] Verify live homeowner paths and server-confirmed receipt with prior retained proof; **do not create fake production clients**.
- [ ] Named founder response coverage for tomorrow; test/observe alert→human response and fallback, using first genuine inquiry where appropriate.
- [ ] Operator GO/HOLD decision, not an assumed automatic launch.
### C. RIVET AUCTIONS — before ANY paid acquisition
- [ ] Actual site publisher and staging preview identified; responsive copy/image UX implemented.
- [ ] Protected runtime DB and scoped CRM integration (Rivet #1) closed with evidence.
- [ ] Seller + buyer/agent real receipt, staff response, error, auth, idempotency and rollback verified.
- [ ] Brokerage/auction rules, reserve format, bidder disclosure, compensation pricing, seller authorization reviewed for live use.
- [ ] Advertising disclosures reviewed, agent/broker footer displayed, consumer FAQ understandable, video footage authorized.
- [ ] Final property-specific participation instructions available or language limited to consultation only.
- [ ] Financial pilot baseline and incremental seller listing/owner-labor economics tracked (Rivet #12).
- [ ] Nathan GO/HOLD with evidence; founder approves budget/activation.

## Simulated Atlas responsibilities — not independent employees
- **Nathan** — scope/decision; publish only after evidence.
- **Jordan** — this checklist, cross-project dependencies, unresolved dissent.
- **Priyanka** — brand image meaning, emotional trust and creative consistency.
- **Marcus** — coherent ad-to-page promises, variant briefs, conversion relevance.
- **Leila** — real comprehension interviews and incremental signed-listing test, not simulated survey results.
- **Olivia/Brittany** — exact response path, offer handling, seller care and agent participation.
- **Daniel/Technology** — branch/publisher/DB/CRM, CI, data-permission proof, real transaction acceptance, no IWCO collisions.
- **Capital** — buyer all-in budgets, brokerage contribution after full labor and failed-listing spend.
- **Challenger** — bait-and-switch, too many choices, premium reducing bids, false 'same care' promise.
- **Legal** — deferred fee design for now, required before binding real auction/contract/fee advertising.
**No real team meetings, approvals, website deployments or customer outreach are implied by issue assignments.**

## Decision log
**2026-11-17 / Creative-first authorization:** Prepare comprehensive message and conversion assets in a feature branch. **No public fee, auction-event or speed/price claim, no merger into current site, no customer sends, no ChatGPT/Google Ads activation.** Preserve the existing site and technical gates while the portfolio message improves.

Official references: https://www.trec.texas.gov/agency-information/rules-and-laws/trec-rules ; https://www.texasrealestate.com/legal-and-ethics/legal-resources/legal-faqs/advertising .
