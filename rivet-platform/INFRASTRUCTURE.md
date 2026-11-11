# Rivet Auctions Infrastructure — Verified Development Boundary

**Decision:** Share the Supabase organization for administration and billing; operate IWCO and Rivet as independent applications/projects/databases. Simulated Atlas technical review; no human employees met.

## Rivet project status — 2026-11-11

- **Supabase project:** `rivet-auctions-development`
- **Project ID (public identifier, not a secret):** `kxcziyznpvbkgtgscdsd`
- **Parent organization:** IWCO Development; **region:** `us-east-1`
- **Provisioned:** yes; verified `ACTIVE_HEALTHY`
- **Initial project creation cost quote:** $0/month; running compute or higher usage may incur costs.
- **Development schema:** `rivet` installed using migration `rivet_initial_private_crm_20261111` from `rivet-platform/sql/initial-schema.sql`
- **Seven tables:** `contacts`, `properties`, `cases`, `inquiries`, `tasks`, `activities`, `staff_memberships`.

## Security verification performed against actual Rivet Postgres

Checked each of all seven `rivet` tables through `pg_catalog`/privilege functions:

- All seven have RLS **enabled**.
- `anon` can neither SELECT nor INSERT.
- `authenticated` can neither SELECT nor INSERT.
- Neither `anon` nor `authenticated` has usage privilege on the `rivet` schema.
- Backend `service_role` has schema usage and table SELECT grants; **keys must stay on the server only**.
- There are no `rivet` RLS policies. This is deliberate: client roles must not directly read customer records.

**Advisor note:** The Supabase security advisor returned seven **INFO** notices named `rls_enabled_no_policy`. They describe the intentional fail-closed private tables, not a detected exposed-data permission. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

The permission checks above **do not** prove that the live ChatGPT Sites `/team` endpoint is protected. The public site is still private and not connected to this separate database.

## Business-to-technology boundaries

- **Rivet repo:** `roger812/rivet-auctions`
- **Working branch:** `development/iwco-reuse-rivet-20261111`; `main` unchanged.
- **IWCO repo:** `roger812/iwco-development` remains independent. No IWCO homeowner data, auth users, runtime keys, or Render service may be reused.
- **Rivet intake and CRM code:** developed and locally unit-tested; not wired to the Supabase project yet. Actual Postgres service credentials, staff login and abuse prevention are intentionally absent from public code.
- **Brand strategy:** `rivet-platform/strategy/FOUNDING_CHARTER.md`; copy config `rivet-platform/brand/site-copy.json`; acquisition plan `rivet-platform/marketing/YELLOW_POSTCARD_PILOT.md`.
- **Current live domain:** the founder-approved ChatGPT Sites site at `rivetauctions.com` remains private and unchanged.

## Remaining nonnegotiable gates

1. Connect a real server-side DB pool to **this Rivet project only**, without leaking credentials; test the full fictional inquiry transaction and rollback.
2. Integrate real Supabase Auth session verification and active Rivet memberships, with revoked/expired/nonstaff tests.
3. Use real bot and rate protection for public inquiry; prove `/team` and every PII endpoint reject anonymous HTTP requests even with a public homepage.
4. Port approved homepage imagery and layout; fill in verified TREC/TDLR broker/auctioneer legal identity, current 2026 IABS, auction fee/terms notices.
5. Deploy a separate Rivet-only Render **preview**; no public domain cutover until tests and founder review.
6. Follow paid-cost approval and one-site-at-a-time rollout; leave IWCO and legacy repos untouched until signed-off cleanup.

**No real customer leads have been loaded and no live site or domain has been changed.**
