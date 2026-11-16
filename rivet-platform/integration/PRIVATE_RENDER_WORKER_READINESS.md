# Rivet → IWCO: private one-shot delivery runner (staged, not activated)

## Current deployment status — 2026-11-16

The **real Rivet development Supabase** intake code, private `rivet.lead_outbox` queue, retry/lease constraints and rollback-only tests have passed. The **real IWCO private database** now contains `iwco_v1.atlas_lead_index` and `iwco_v1.atlas_business_access`, added with migration `20261116080507`. A signed fictional lead has traversed the actual Rivet → IWCO HTTPS path and been indexed and searched inside the actual IWCO database under an outer rollback-only transaction. All temporary proof endpoints were disabled immediately.

**Ongoing delivery remains OFF.** There is no persistent, deployed Rivet worker; no long-lived bridge HMAC secret or active IWCO business access grants. The active IWCO homeowner CRM has not been modified beyond adding two empty private tables. Do not auto-enable this worker or send real customer information.

## New staged private runtime

- `src/atlas-private-job.mjs`: one-shot `runRivetAtlasDevelopmentJob` that returns `{status:'disabled'}` unless explicitly enabled. A **development-only** mode must be selected. It validates HMAC and Rivet-only database host, enforces a verified CA chain, claims at most one outbox event and closes the database pool.
- `bin/atlas-delivery-once.mjs`: CLI wrapper. With the enable flag absent, it prints `rivet_atlas_job_disabled`, imports no DB driver and does no network activity. With explicit enable flag, it loads `pg`, runs one event and logs only safe status/attempt/error-code fields.
- `tests/atlas-private-job.test.mjs`: covers zero network use when disabled, fail-closed mode/key/project/CA guards and signed delivery with resource cleanup.
- Run `npm run atlas:dev-once` from `rivet-platform/` to verify the default disabled behavior. This is not a scheduled worker.

## Exact private worker configuration (future, not provisioned)

A private Render Cron service or another trusted backend may eventually run one **development-only** invocation when all release gates are met, using protected environment variables **not committed to GitHub**:

| Name | Required value | Purpose |
|---|---|---|
| `RIVET_ATLAS_DELIVERY_ENABLED` | `1` after approval | Explicit off-by-default enable switch |
| `RIVET_ATLAS_MODE` | `development_proof` | Refuse production/unknown modes |
| `RIVET_DEV_DATABASE_URL` | Privately stored **Rivet development-only** PostgreSQL connection string | Project-pinned DB access; not IWCO |
| `RIVET_DEV_DB_CA_PEM` | Trusted certificate PEM in protected environment | TLS server verification; do not disable |
| `RIVET_ATLAS_SHARED_KEY_HEX` | Dedicated private 32-byte hex key matching IWCO receiver | Timestamped HMAC event delivery |

The transport targets the explicitly reviewed private IWCO preview host via `createRivetAtlasSender`. Changing that host requires code review. A deployable Node image would need the exact `pg@8.16.3` dependency pinned **with a lockfile**; this preview module deliberately does not ship a package lock or provision deployment credentials.

**Least privilege remains a release gate:** The development connection guard currently accepts only Rivet's Supabase `postgres` project user/pooler identity, rather than a dedicated narrowly restricted application role. Do not approve a persistent customer-data worker until a restricted source DB role, verified TLS credentials and scoped access are implemented and tested. Do not place privileged PostgreSQL credentials in a public site, issue, PR body, or chat.

## Operational release sequence

1. Finish restricted source DB role, pooler verification, dedicated HMAC key provisioning in secure backend environments and a reviewed Node runtime dependency lockfile.
2. Verify the IWCO private receiver is deployed on a protected **preview**, has its own workspace-bound backend DB role, and returns a genuine idempotent indexed receipt.
3. Approve **specific actual IWCO staff** for Rivet source access. No automatic grants and no direct anonymous/client DB privileges.
4. Test a fictional *persisted* lead through a private end-to-end deployment, then clean the fixture and independently verify customer detail authorization, source consent and duplicate replay.
5. Run all original IWCO CRM contact/card, case/deal, Gmail/SMS and mobile regressions. Obtain explicit founder release approval before transferring real inquiries.

A previous temporary signed HTTP smoke returning 200 is **not** permission to activate live lead transfer. Each business retains its own private customer records and communications sender identities.
