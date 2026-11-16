-- Rivet development: create disabled service identity for source detail lookup.
-- This is NOT a usable credential and must never accept customer traffic.
-- Separate activation requires a secure password + protected secrets and review.
BEGIN;
DO $rivet_principal$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rivet_atlas_detail_login') THEN
    RAISE EXCEPTION 'rivet_atlas_detail_login_already_exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rivet_atlas_detail_reader' AND NOT rolcanlogin AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'restricted_reader_missing_or_unsafe';
  END IF;
END $rivet_principal$;

CREATE ROLE rivet_atlas_detail_login
  NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;

-- Explicitly inherit only the already audited, column-limited SELECT grants.
-- No SET ROLE escalation, no ownership, no writes or other role membership.
GRANT rivet_atlas_detail_reader TO rivet_atlas_detail_login
  WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;

COMMENT ON ROLE rivet_atlas_detail_login IS
  'INERT placeholder: Rivet-to-Atlas source detail service; NOLOGIN until separately approved protected-credentials activation';

COMMIT;

-- Activation is NOT part of this migration.
-- Never put a password or live connection string in SQL tracked by GitHub.
