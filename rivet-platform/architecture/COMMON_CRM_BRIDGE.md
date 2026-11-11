# Common CRM integration plan — preserve both active builds

**Status:** Development interface and Rivet staging only, not a live integration or a company-wide CRM migration. **Decision:** Develop source websites independently; prepare a common event contract; avoid requiring the future CRM to be ready before lead capture.

## Architecture principle

One place for employees to work, with independently controlled business data. A branded website is an *origin*, and the CRM is an *operator workspace*. These must not be confused:

- **Business / tenant:** IWCO, Rivet Auctions, Rivet Real Estate, Deep's future services business, etc.
- **Lead type / interest:** cash-offer seller, auction seller inquiry, auction buyer inquiry, listing consultation, tutoring customer inquiry.
- **Acquisition source:** yellow postcard, organic website, paid search, social, referral, phone number, or manual intake.
- **Campaign:** optional campaign ID and creative version. Preserve original source, and record later touchpoints without overwriting it.
- **Assigned team:** workspace memberships and role/record permissions, not public form values.
- **Contact and consent:** per-business access rules, contact preferences, audit trail, and lawful transfer/communications basis.
- **Case and task:** separate opportunity/case objects from the person, so one person can have multiple unrelated inquiries without merging consent.

A customer submitting a Rivet Auctions seller inquiry is **not** automatically agreeing to sell by auction. Preserve the source and inquiry type while a human decides the appropriate route.

## Built on the Rivet development branch

1. `src/atlas-lead-envelope.mjs` is a versioned, repeatable metadata-only event format. The source business comes from trusted server configuration, not from a client-supplied field. It carries a stable case reference, original business, lead type, source channel, a reported attribution code, an unassigned default and limited reply-consent status.
2. `sql/lead-outbox.sql` creates a private outbox in the existing *Rivet development project*, with RLS and no direct `anon` or `authenticated` access. Applied via `rivet_lead_outbox_20261111`.
3. `src/postgres-repository.mjs` now enqueues the event **within the same transaction** as the contact, case, inquiry, task and activity. If the outbox write fails, the entire intake rolls back; a replay of a previously stored request does not create a second event.
4. No PII is placed in the shared index envelope. Names, phone numbers, email, addresses, notes, deal economics, and conversations remain private in the source business.
5. Automated GitHub Actions tests validate these properties. This is a dry integration foundation; it does **not** send leads to the future Atlas CRM.

## What to do when the shared CRM exists

- Expose a dedicated authenticated integration endpoint per business. Use scoped, rotated machine credentials; do not use browser tokens or one shared Supabase service key.
- Deliver outbox events via a reliable worker with authenticated requests, idempotent recipient writes, replay handling, backoff and a dead-letter queue. Authenticate the sender and validate every declared business ID server-side.
- Central inbox queries may index metadata from all businesses but retrieve PII **only when** the staff member has access to that business and case. Never grant access on the basis of a tag or UI filter.
- Assign staff permissions per legal/business workspace. A Deep business user must not read IWCO records. A central administrator still needs a justified, auditable privilege boundary.
- Preserve original lead attribution and separate the **lead source** from **lead status**, **business**, and **opportunity type**.
- Do not silently merge a person's records across IWCO, Rivet and Deep, or treat consent to reply in one business as marketing permission for another.
- Keep dedicated numbers and email sending domains by brand, although administration and billing may be shared. Messaging webhooks must use the recipient number/brand to select the correct workspace.
- Prove one fictional end-to-end lead in the central inbox before enabling the first real customer case. Keep the old workflow operational with a rollback.
- Do not migrate the live IWCO CRM database to a new owner/domain without a rehearsed transactional export/import, reconciliation, secure sessions and a cutover plan.

## Important distinction: optional paths

- **Centralized Atlas CRM database** (long term): one data store with strict business/record authorization. Requires a dedicated tenant/access audit and a non-disruptive IWCO migration.
- **Unified inbox over independent databases** (transitional): lower short-term disruption but more connector and reconciliation complexity.
- **Separate full CRMs for every business:** explicitly *not* the preferred long-term operator experience.

This design leaves the central CRM deployment destination open while avoiding vendor lock-in. A future domain such as an Atlas operations domain can be selected after branding and name clearance. **No domain purchase or public rollout is authorized by this plan.**

## Evidence and outstanding gates

- **Verified:** Rivet outbox exists in Supabase project `kxcziyznpvbkgtgscdsd` and has RLS enabled. Direct `anon` and `authenticated` SELECT/INSERT privileges are false. Service role may access it server-side.
- **Verified:** [GitHub Actions development test](https://github.com/roger812/rivet-auctions/actions/runs/43103655868) — 50 tests passed, 0 failed.
- **Unverified/unbuilt:** actual sending worker; integrated production staff auth; live Supabase server connectivity; real customer-data read authorization from a central inbox; live HTTP security; cross-system consent and communication deliverability.

**Change-control gate:** no automatic sync or production database consolidation without an explicit business decision and completed access testing. Existing IWCO and live Rivet website remain unchanged.
