# Rivet Auctions — independent development platform

**Project:** Rivet Auctions (real estate only)  
**Repository:** `roger812/rivet-auctions`  
**Branch:** `development/iwco-reuse-rivet-20261111`  
**Status:** DEVELOPMENT, not deployed. Separate Rivet Supabase schema now installed and permission-checked. The approved ChatGPT Sites experience at `rivetauctions.com` has not been replaced.

## Reuse strategy

Adapt IWCO's architecture and lessons learned, **not** its homeowner data, secrets, email credentials, or production settings. Primary reference: `roger812/iwco-development`, particularly its managed API, consented intake, session, and CRM/checkpoint components. Both applications must be operationally independent.

The approved Rivet Auctions website is a brand and lead-capture experience with a sunny Central Texas home image. It is for **real estate only**, not fine art, and it does **not** publish a listing catalog or publicly display highest offers. Buyers can ask for offer information after team review; a buyer cannot change the verified highest offer through a public request.

## What has been implemented on this branch

| Component | Implementation | Production status |
|---|---|---|
| Staff route boundary | `src/access-boundary.mjs` denies unauthenticated/unapproved users from `/team` and `/api/team/requests` | Requires real verified staff sessions |
| Seller and buyer intake | `src/public-intake.mjs` validates minimal contact information, explicit reply consent, idempotency keys, bounded body size, and server-supplied bot/rate checks | Requires real anti-bot and rate-limit adapters |
| Transactional CRM | `src/postgres-repository.mjs` atomically creates contact, optional property, case, receipt, initial task, and event; retries return previous receipt | Not connected to a real database |
| Data model | `sql/initial-schema.sql` defines Rivet-only contacts, properties, cases, tasks, activities and staff membership | Applied to separate Rivet Supabase development project; all seven RLS-enabled tables reject direct anon/authenticated access |
| Routing | `src/application.mjs` composes public intake and staff-only endpoints without making the staff desk public | No hosting runtime or frontend integration yet |
| Seller options | `src/seller-decision.mjs` supports human-led option comparison and no-auction decision | Unit-tested; not part of a customer-facing app yet |
| Brand and operating charter | `strategy/FOUNDING_CHARTER.md`, `brand/site-copy.json`, `marketing/YELLOW_POSTCARD_PILOT.md` | Defined and source-controlled; not public advertising |
| Atlas common CRM handoff | `src/atlas-lead-envelope.mjs`, `sql/lead-outbox.sql`, `architecture/COMMON_CRM_BRIDGE.md` | Rivet-only private outbox is installed; no real cross-business sync or PII transfer is enabled |
| Verification | `tests/*.test.mjs` (50 local/mocked tests) | GitHub Actions passed 50/50; live HTTP/auth, actual DB transactions and central inbox integration remain |

Run the tests from `rivet-platform` with Node 22+: `npm test`. There are no external dependencies for this development test package.

## Nonnegotiable security boundaries

- Never serve homeowner data or CRM details publicly. `/team` and every customer-data API require an independently verified staff identity **and** an active Rivet authorization record.
- No client-supplied role, email, or unverified JWT user metadata can grant access.
- Private PostgreSQL schema, with RLS enabled and no `anon`/`authenticated` grants. Database credentials remain server-side.
- New inquiries require an explicit reply-only consent. No bulk marketing permission is implied.
- Use a real, server-verified human challenge and trustworthy request throttling before accepting live inquiries. Fake adapters exist in tests only.
- The current `/team` HTML response is a placeholder until the approved team desk is safely ported.
- Never connect buyer-submitted prices to the verified highest-offer record.
- Do not import IWCO leads, re-use IWCO secrets, or alter IWCO deploys.

## Next build gates

1. **Done:** Provision the separate Rivet Supabase development project and apply private schema. Catalog privilege checks confirmed no anon/authenticated access; advisor INFO notices describe intentionally policy-free private tables. Still test an actual end-to-end database transaction.
2. Add a real session verifier, Rivet-only membership provisioning, rate-limiter, and anti-bot adapter. Test with a real HTTP server and actual database.
3. Port the approved sunny Rivet public pages and private team desk to this backend; preserve the minimal lead capture.
4. Put a Render **preview** URL online, prove unauthorized users cannot fetch `/team` or private APIs, and verify seller/buyer-to-CRM handoff with fictional data.
5. Configure authorized email/Slack handoff, legal/privacy notices, rollback, and only then plan a domain cutover. Keep the current website private until access controls are verified.
6. Archive obsolete repository/site prototypes after the replacement is proven. Delete only with explicit owner approval and exact targets.

**Live status:** Rivet Supabase development schema plus metadata-only lead outbox installed (no customer records imported); no Render service for Rivet created and no live site, DNS, customer records, or IWCO resources changed by this development work.
