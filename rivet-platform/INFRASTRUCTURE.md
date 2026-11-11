# Rivet Auctions infrastructure boundary

Decision: share the **Supabase organization** for administration and billing, but keep **independent projects** for every business. This is an architectural decision made with simulated Atlas functional perspectives; no live human staff were convened.

## Provisioned on 2026-11-11

- Supabase project: `rivet-auctions-development`
- Project reference (not a secret): `kxcziyznpvbkgtgscdsd`
- Organization: `IWCO Development`
- Region: `us-east-1`
- Project status at verification: `ACTIVE_HEALTHY`
- Security advisor result at creation: no findings on the empty project
- Initial `public` table list: empty
- Project creation quote: $0/month; future compute/usage may be billed independently.

## Guardrails

- Never reuse IWCO's database credentials, auth sessions, service role keys, or homeowner records.
- Any Rivet schema deployment goes only to project `kxcziyznpvbkgtgscdsd`.
- Do not deploy anything from this branch to the approved `rivetauctions.com` site until real sign-in, data-access security, and anonymous tests pass.
- Keep `roger812/rivet-auctions` as source-of-truth repository. New Render preview service must be distinct from IWCO services.
- Next: run the candidate `sql/initial-schema.sql` through isolated SQL migration verification; apply only after review, then test zero anonymous access.
