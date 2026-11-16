# Rivet → IWCO authorized contact-card lookup

**Status: implementation and tests staged; restricted database reader installed in Rivet DEVELOPMENT, but no live read endpoint, login credential, or IWCO contact-card access is enabled.**

## User behavior
When an approved staff member searches **Business leads** in the IWCO CRM and selects **Open contact card** for a `Rivet Auctions` lead, IWCO should display the existing Rivet source record's contact name, phone/email, property address, inquiry kind/stage and reply-permission evidence. This must be **read-only** and must not merge that person into the IWCO homeowner `cases` or `contacts` tables.

## Security design
1. The staff browser requests one lead detail from the **existing authenticated IWCO CRM** route. It never receives a Rivet database credential.
2. The IWCO server confirms the active actor's workspace membership, operator readiness, explicit `atlas_business_access` for `rivet-auctions` and the exact indexed `lead_ref` + `inquiry_ref`. Neither business/source tags nor the lead UUID alone grant access.
3. The IWCO backend signs a small `staff_case_review` request using an **independent 256-bit Rivet detail-read secret**, a short timestamp window, and a fixed Rivet Supabase HTTPS endpoint. It never sends the IWCO staff session cookie to Rivet.
4. Rivet's `createRivetAtlasDetailReader` validates the HMAC in constant time, matches both case and inquiry IDs in a parameterized SQL join, and returns only an explicit allowlist of contact and consent fields. It cannot send SMS/email and never returns internal intake notes.
5. On receiving the response, IWCO validates its exact structure and performs the **staff authorization query again** so revocation during the network hop prevents disclosure.

## Installed development-side database boundary
Tracked Supabase migration **`20261116083352_rivet_atlas_no_login_detail_reader_20261116`** in development project `kxcziyznpvbkgtgscdsd` created a **NOLOGIN**, **NOBYPASSRLS**, non-inheriting role `rivet_atlas_detail_reader`. It has:
- `USAGE` on private `rivet` schema.
- Only column-specific `SELECT` on the fields required from `cases`, `contacts`, `properties` and `inquiries`.
- Four `SELECT` RLS policies limited explicitly to that role.
- No rights to read `case.intake_note`, property `note`, `lead_outbox`, tasks, activity history or private staff membership; no `INSERT` or `UPDATE`.

**Validation:** All role/grant checks passed on the actual project. Existing Rivet contacts/cases/inquiries/outbox remain **0**. Public `anon` / `authenticated` still have no SELECT. Supabase advisor produced only four unrelated informational deny-by-default RLS notices. The same complete role-specific SQL join/permissions test passed in disposable PostgreSQL CI. The managed Supabase `postgres` account could not use `SET ROLE rivet_atlas_detail_reader` because it had **not** been granted membership in the new role; this is an intentional non-grant, not a reason to widen privileges.

## Code/tests
- Rivet: `src/atlas-lead-detail.mjs`, `tests/atlas-lead-detail.test.mjs` and `sql/atlas-read-only-detail-role.sql`.
- IWCO: `application/atlas-inbox/source-detail.mjs` plus API integration, `Open contact card` UI and isolated authorization tests in [IWCO draft PR #130](https://github.com/roger812/iwco-development/pull/130).
- Actual cross-repository signed-lookup contract is tested using fictional data in `application/atlas-inbox/ci-cross-repo-contact-detail.mjs`; no source PII leaves a live database in that test.

## Do not activate without
- Separate restricted **LOGIN** backend identity allowed to assume `rivet_atlas_detail_reader`, with protected credentials and verified TLS. No browser client or broad `postgres` key.
- A reviewed Rivet HTTPS read-only handler mounted behind the signed machine contract; HMAC secret provisioned only in secure environment configuration.
- IWCO private staff view activated behind separate `IWCO_ATLAS_SOURCE_DETAIL_ENABLED=1` and `IWCO_ATLAS_RIVET_DETAIL_KEY_HEX`. Business-grant assignments must be approved per real staff user.
- Real hosted read-path proof and audit logging, testing an authorized and unauthorized staff account without disclosing real customer data.
- Full IWCO CRM regression tests and founder release approval. **Neither the new source role nor the code changes authorize routing actual customer leads yet.**
