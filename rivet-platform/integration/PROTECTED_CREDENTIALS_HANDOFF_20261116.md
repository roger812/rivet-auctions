# Rivet source detail: protected credential handoff (2026-11-16)

## Verified prerequisites

- Supabase project: `rivet-auctions-development`, ref `kxcziyznpvbkgtgscdsd`. Separate from IWCO project `llizgsrbqhonvruxaoho`.
- The restricted role `rivet_atlas_detail_reader` has only column-specific SELECT permissions for case, inquiry, contact and property fields. It is `NOLOGIN`, `NOBYPASSRLS`.
- The intended runtime identity `rivet_atlas_detail_login` exists, still `NOLOGIN`, `NOBYPASSRLS`. It inherits only the reader role, without SET or ADMIN capabilities.
- Source HTTPS Edge endpoint `rivet-atlas-lead-detail` is deployed **inactive**. It returns a non-PII 503 until all required secrets and the enable flag are present. The endpoint refuses admin database credentials and expects TLS certificate validation.
- Source Edge Function secret names were entered by the founder: `RIVET_ATLAS_DETAIL_KEY_HEX` and `RIVET_ATLAS_IWCO_WORKSPACE_ID`. Render private-preview Environment includes `IWCO_ATLAS_RIVET_DETAIL_KEY_HEX`. **Neither presence nor matching protected secret values were verified cryptographically yet.** Do not copy values into issues, chat, CI, SQL output or Git.
- Current counts at last check: IWCO 16 cases / 16 contacts / 0 indexed Rivet leads / 0 business grants. Rivet development 0 contacts/cases/outbox.

## Preferred next operator action — dedicated role password via protected UI

Use [Supabase Rivet Database Roles](https://supabase.com/dashboard/project/kxcziyznpvbkgtgscdsd/database/roles). Locate the **existing** `rivet_atlas_detail_login` custom role (do not create another `postgres` login; do not change the project's main database password).

If the UI supports an existing-role password editor and login toggle:

1. Generate a new dedicated high-entropy password with a password manager or `openssl rand -hex 32 | pbcopy` on your own Mac, then immediately store it in your password manager.
2. Enable LOGIN **only on** `rivet_atlas_detail_login`, with this new password. Keep all other role permission toggles unchanged.
3. Never paste the password in ChatGPT, GitHub or an AI SQL tool result. Do not use an inline `ALTER ROLE ... PASSWORD` statement in an AI agent or saved SQL Editor query. Supabase cautions that role credentials can enter project logs and failed-statement details.
4. Do not enable `RIVET_ATLAS_SOURCE_DETAIL_ENABLED` yet. The endpoint must remain off while the restricted DB URL and CA are provisioned.

If the dashboard cannot set a custom role password, stop and use an approved secure administrator channel (e.g. direct `psql` interactive `\\password` with protected access, or Supabase-supported Management API). Do not work around this by connecting as admin `postgres` or disabling TLS/RLS. See [Supabase guidance on logging-safe credential provisioning](https://supabase.com/kb/troubleshooting/provisioning-credentials-without-log-exposure).

## After role login is protected

In **Rivet** Edge Functions > Secrets (not IWCO), add:

- `RIVET_ATLAS_DETAIL_DB_URL`: a valid PostgreSQL URL for `rivet_atlas_detail_login` targeting **Rivet development only**. The current guard permits direct `db.kxcziyznpvbkgtgscdsd.supabase.co` with user `rivet_atlas_detail_login` or verified pooler with user `rivet_atlas_detail_login.kxcziyznpvbkgtgscdsd`; check the current project connection dialog for the actual endpoint. The URL contains a password and must stay in the protected secrets manager. Do not put credentials into a query string or use unverified pooler hosts.
- `RIVET_ATLAS_DETAIL_DB_CA_PEM`: the official verified database CA certificate PEM. Do not disable TLS verification.
- `RIVET_ATLAS_DETAIL_KEY_HEX`: already created. Do not regenerate unless matching IWCO preview key is rotated simultaneously.
- `RIVET_ATLAS_IWCO_WORKSPACE_ID`: already created. Identifies which IWCO workspace may make signed calls.

On **IWCO's private Render preview**, ensure the corresponding protected `IWCO_ATLAS_RIVET_DETAIL_KEY_HEX` matches byte-for-byte. The branch on the existing Render preview is not the feature branch; simply installing this secret does **not** make contact cards available.

## Activation and testing gates

1. Independently verify login role: correct project, no bypassrls, no write, no notes/outbox access. Verify TLS using an approved private backend.
2. Deploy a **restricted preview** built from the IWCO feature branch, retaining `IWCO_ATLAS_SOURCE_DETAIL_ENABLED=0` and lead-index gates off until read endpoint tests pass.
3. Cryptographically verify the source/preview signing keys without printing their values. Do not infer match from names alone.
4. Provision named real IWCO staff identities and explicit business grants only after identity verification and user authorization; the existing `IWCO Test Operator` is not equivalent to Rosie or Nancy.
5. Test one fictional indexed lead and source contact card from an authorized real staff session and a denied staff session, including immediate revocation, then delete fixture and rerun full IWCO CRM regressions.
6. Obtain founder release approval before customer-data transfer, live deployment or feature switch enabling.

No customer emails/SMS, site tracking or staff grants should change during credential setup.
