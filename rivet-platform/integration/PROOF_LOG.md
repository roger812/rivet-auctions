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

## Dedicated Node/Render-hosted proof still staged (not yet executed on Node hosting)
- `src/server-db.mjs` validates Rivet-only database host/username, requires a private CA certificate and requires verified server-side TLS.
- `tests/server-db.test.mjs` has no real credentials and tests this configuration.
- `integration/live-repository-proof.mjs` composes the **actual** public intake handler with the Postgres repository through a verified server-side connection. The test uses an outer transaction plus inner savepoints, so it cannot commit fictional data to a live inbox or send a lead to IWCO.
- **The Node 22/Render-hosted variant has not yet run**: no protected external-host database password, exact Supabase pooler hostname or CA has been supplied. The actual repository code did subsequently connect on Supabase's own server-side Edge (Deno) runtime (evidence below), but that does not verify the Node 22/Render network path or IWCO CRM delivery.

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


## Additional application-level proof — isolated GitHub CI

- [GitHub Actions run 43821195001](https://github.com/roger812/rivet-auctions/actions/runs/43821195001): **completed successfully** using Node 22 and an actual disposable PostgreSQL 17 service.
- The new `integration/ci-postgres-proof.mjs` exercises the real `createRivetPublicIntake` handler and real `createRivetPostgresRepository` against the real Postgres driver; it does not mock SQL writes.
- Confirmed: 201 first seller inquiry; seven related private records; `rivet-auctions` metadata event without customer PII; 200 identical replay; 409 altered replay; 503 deliberate outbox failure with zero partial contact; all eight tables use RLS and both public/authenticated roles cannot read; all fictional writes rolled back.
- This **complements**, but does **not** replace, the live Rivet Supabase connection proof. That distinct gate still requires a private runner/credential and remains open.
- No IWCO code, configuration, customer records, Render service, email or SMS state changed.

## REAL Rivet project app-to-Supabase integration proof — 2026-11-16 07:48 UTC

**PASSED** against the genuine project \`kxcziyznpvbkgtgscdsd\` using a temporary authenticated Supabase Edge Function (Deno runtime, Node-compatible pinned \`pg@8.16.3\`) and actual \`createRivetPublicIntake\`, \`createRivetPostgresRepository\` and \`makeRivetAuctionLeadEnvelope\` source files copied from this branch.

- The Edge environment supplied its protected \`SUPABASE_DB_URL\`; no database password or service-role key was exposed to the browser, repository, chat or CI.
- A 256-bit single-use authorization token was stored **only as a SHA-256 hash** in an expiring private \`rivet.dev_proof_tokens\` table; Edge also required \`verify_jwt=true\`. Admin-triggered invocation used Supabase's \`pg_net\` in the *development project*, never the IWCO project.
- One fictional seller inquiry exercised the **real** application handler against the **actual** private Rivet PostgreSQL database within an outer rollback transaction. Verified seven linked relational record types, metadata-only lead event, 201 first intake, 200 duplicate replay, 409 changed-body conflict, 503 injected outbox failure, no orphan contact, and blocked anonymous/authenticated reads.
- The HTTP response was **200** with \`{"proof":"passed","location":"rivet-development-supabase","fictional_records_remaining":0,"iwco_modified":false}\`. SQL verification afterward returned **contacts=0; cases=0; inquiries=0; outbox=0; anon_denied=true**.
- The temporary Edge Function \`rivet-dev-one-time-proof\` was immediately **redeployed as an inert 410 Gone response**, version 2, still JWT-gated. The proof-token table, \`pg_net\` extension and temporary \`net\` schema were removed. SQL post-cleanup verified those are absent. No real records or customer communications were created.
- Supabase's security advisors reported only eight **INFO** \`rls_enabled_no_policy\` notices for the private Rivet tables; those are intentional deny-by-default controls, not an authorization grant.
- Reproducible temporary proof source: \`integration/edge-private-proof/index.ts\`. This is a **server-side Deno compatibility proof**, not an assertion that the separate Render/Node 22 runtime or cross-company network integration has been deployed.

**What is now verified:** Actual Rivet application repository → actual Rivet development Supabase. **What is not yet enabled:** Node 22 on Render → Supabase; production Rivet → IWCO durable delivery and persistence; the live IWCO business-lead schema/grants; or end-user detail access. Separate environments and real customer data remain unchanged.


## Actual signed Rivet-to-IWCO HTTPS connection proof — 2026-11-16, ~07:56 UTC

**PASSED**: A fictional, metadata-only Rivet event traversed a **real HTTPS request from the Rivet Supabase project to the separate IWCO Supabase project**.

- The sender used the real `createRivetAtlasSender` module; the IWCO test receiver used the real `createAtlasLeadReceiver` and strict lead-index normalization. Supabase Edge functions were temporary, protected by a short-lived 256-bit test HMAC/challenge, and did not touch production customer records or Render routes.
- **Observed HTTP 200** from the Rivet source. Body: `proof=passed`, `transport=actual_cross_project_https`, `signature=verified`, `business=Rivet Auctions`, `source=google`, `delivered=true`, and **`receiverPersistent=false`**.
- The first test encountered the Deno compatibility error `Buffer is not defined`. Fixed this by explicit `node:buffer` imports in Rivet `src/atlas-signed-delivery.mjs` and IWCO `application/atlas-inbox/receiver.mjs`, then the real HTTPS retest passed.
- **This smoke receiver DID NOT write the IWCO lead-index database.** The prior disposable-PostgreSQL cross-repo CI did prove the actual index persistence, authorization, and search logic separately; the two proofs are not equivalent to an active production service.
- After passing, both temporary functions were redeployed to JWT-gated **410 Gone** inert handlers, version 4. The Rivet `pg_net` test-only extension and `net` schema were removed again. Post-cleanup Rivet `contacts=0`, `cases=0`, `outbox=0`.
- Read-only verification of the actual IWCO project `llizgsrbqhonvruxaoho`: neither `iwco_v1.atlas_lead_index` nor `iwco_v1.atlas_business_access` is installed yet. No authorized business grants, customer PII, SMS/email or production route were changed.

**Remaining activation gates:** review and install new IWCO private metadata-index tables and least-privilege runtime grants, set independently managed production HMAC secret on source and receiver, verify production Node/Render backend connection, deploy the durable source outbox worker, prove signed delivery **persists** and is searchable by a real authorized staff account, and only then enable real lead routing.
