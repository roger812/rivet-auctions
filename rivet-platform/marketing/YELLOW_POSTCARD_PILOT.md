# Rivet Auctions — Yellow Postcard & Direct-Mail Pilot

**Status:** Planning / not mailed. The founder reports another response to a yellow postcard campaign, but we have not established whether that campaign belongs to IWCO, CSH, Rivet Real Estate, or Rivet Auctions. **Do not move that person's information into Rivet by assumption.**

## Why this is a signal, not a conclusion

A response shows an offer or format can motivate a homeowner to respond. It does not yet tell us the conversion rate, profit, whether the homeowner needs a cash offer or broker-led sale, or whether the seller's property suits an auction.

**Research owner (simulated):** Leila Grant  
**Acquisition owner (simulated):** Marcus Ellison  
**Seller follow-up design (simulated):** Sophia  
**Execution and feedback (simulated):** Morgan  
**Economic signoff (simulated):** Daniel

## Pilot business purpose

Generate *qualified conversations* with owners who want to compare selling routes, not just collect responses to provocative postcards. An auction is not presumed from the response.

## Two creative tests (review compliance before mailing)

**A — Choice first:** “Thinking about selling but not sure which route makes sense? There may be more than one way to move forward. Talk with a local real estate broker and auctioneer about your options.”

**B — Competition explained:** “Wondering whether a competitive sale could work for your property? We can help you compare a traditional listing, selling as-is, and a structured competitive process. No obligation to list.”

Neither creative may claim an offer exists, a buyer is waiting, a higher price is guaranteed, or a property has already been selected for auction. Before any mailing, add the exact TREC brokerage identity, TDLR licensed auctioneer name/number where legally required, correct address and any other mandatory notices. Obtain compliance review.

## Rivet-specific attribution

**Do not reuse IWCO's campaign identifiers or homeowner records.**

For a future Rivet pilot only, set the campaign source on its landing link and intake payload to `rivet_dm_yellow_a01` or `rivet_dm_yellow_b01`. The existing new Rivet CRM already has a source field; it does not yet have a production QR code or campaign database. A source string is *self-reported marketing attribution*, not evidence of delivery or verification.

**Test URLs only, not for mailing now:**
- `https://rivetauctions.com/?source=rivet_dm_yellow_a01`
- `https://rivetauctions.com/?source=rivet_dm_yellow_b01`

The current public website must remain private until the separate Render/application route, server-side staff access controls and required notices pass testing.

## Required campaign ledger fields

- Business, campaign ID, creative version, list segment, geographic scope, mail vendor, mail date.
- **Denominator:** pieces mailed, delivered estimates, printing+postage+list total costs.
- **Response:** calls, forms, email inquiries, duplicates, opt-outs.
- **Qualification:** homeowner conversations, owner authority/representation, appointments and route comparisons.
- **Outcomes:** auction suitable/not suitable, listing signed, auction agreement, no sale, referrals with consent, contracts, closings, realized contribution margin.
- **Safety:** privacy complaints, misleading-message complaints, do-not-contact flags, source of customer consent.

Track response rate = unique responses / pieces mailed; appointment rate = consultations / unique responses; signed agreement rate = agreements / consultations; paid CAC = all campaign costs / signed agreements, with 'not meaningful' when denominator zero.

## Human response script for a postcard inquiry

“Thanks for getting in touch about the postcard. Before we talk about selling, what are you hoping to accomplish with the property? I can explain the options, including a regular listing, selling as-is, or—if the property is suitable—a more competitive sales process. You don't have to decide anything on this call.”

Ask for permission to continue and follow applicable representation and IABS delivery requirements. Don't ask about title or financial distress before establishing trust and purpose.

## Next run / go-no-go gates

1. Identify which company actually mailed the current yellow postcard and review its existing response before assigning any Rivet attribution.
2. Verify brand/copy and licensing details; complete current TREC IABS.
3. Run small, capped A/B pilot only after staff is ready to answer responses and paid budget is explicitly approved.
4. Monitor daily lead stage/source and weekly conversion economics; pause any creative that attracts confusion or complaints.
5. Never claim an automated SMS/email reply is functioning until provider tests confirm delivery.

**No homeowner data or spend has been created by this planning file.**
