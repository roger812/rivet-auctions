# Rivet Auctions — DB proof log (2026-11-16)

## Founder routing decision
The **existing IWCO staff CRM** is the intended single operator inbox for IWCO, Rivet Auctions and future brand leads. Rivet submissions are entered under **Rivet Auctions** source/interest, rather than being sent through IWCO's consumer-facing intake. The common CRM cross-business delivery is **not yet live**. Preserve permissions and consent by business; do not share records indiscriminately.

## Verified against the real isolated Rivet development Supabase database
- Project: `rivet-auctions-development`, ID `kxcziyznpvbkgtgscdsd`.
- Project status: active and healthy.
- All eight `rivet` tables have RLS enabled.
- Neither `anon` nor `authenticated` has usage on the private schema or SELECT on the eight tables.
- Ran `integration/private-db-smoke.sql` equivalent through the Supabase SQL connector. All seven related record types (contacts, properties, cases, inquiries, tasks, activities and lead_outbox) were inserted within a reversible test subtransaction. Verified uniqueness protection on inquiry request keys and outbox idempotency keys. Forced an invalid outbox event and confirmed earlier contact/case writes were reverted.
- Tool result: `schema_proof=passed; contacts=0; cases=0; inquiries=0; outbox=0; anon_denied=true; ordinary_users_denied=true`.
- No customer data was used or imported. All fixture writes were rolled back and the final counts were zero.

## Implementation staged, NOT yet live-verified
- `src/server-db.mjs` validates Rivet-only database host/username, requires a private CA certificate and requires verified server-side TLS.
- `tests/server-db.test.mjs` has no real credentials and tests this configuration.
- `integration/live-repository-proof.mjs` composes the **actual** public intake handler with the Postgres repository through a verified server-side connection. The test uses an outer transaction plus inner savepoints, so it cannot commit fictional data to a live inbox or send a lead to IWCO.
- **That Node end-to-end test has not yet run**: no database password/CA or private runner has been provided to this work session. No claims of app-level live DB connectivity, GitHub Actions results, or IWCO CRM delivery are authorized by the SQL proof.

## Controlled private Node test prerequisites
1. Run on a trusted private backend/runner with Node 22+ and reviewed pinned `pg` client (for example `8.23.1`). Do not install a driver in a public browser, publish credentials, or copy a database password into an issue/chat.
2. Provide protected environment secrets: `RIVET_DEV_DATABASE_URL`, `RIVET_DEV_DB_CA_PEM`, and `RIVET_DEV_DB_PROOF=I_ACKNOWLEDGE_DEV_ONLY`.
3. If the dashboard connection URI has `sslmode`, `sslcert`, `sslkey`, or `sslrootcert` query parameters, remove those and configure TLS through the separate verified CA option as required by node-postgres. The connection factory denies conflicting parameters rather than silently downgrading certificate verification.
4. From `rivet-platform`, execute `node integration/live-repository-proof.mjs`. This invokes the handler with a **fictional** Request (not public HTTP); tests first insert, repeat, same-key conflict, forced outbox failure and permission gates. Always rolls back.
5. Check zero residual fixture records, then record sanitized outcome here. Do not proceed to a public deploy or cross-business sync from this test alone.

## Remaining gates
- Execute and independently review the actual Node-to-Supabase proof above.
- Configure real staff authentication + roles and separately verify unauthorized HTTP endpoints.
- Build a separate Rivet preview; only then connect **authorized** Rivet lead metadata/dedicated customer record access to the existing IWCO CRM operator workspace.
- Keep IWCO's Gmail and Twilio secrets, databases and sending identities separate. No IWCO production changes are made by this branch.
