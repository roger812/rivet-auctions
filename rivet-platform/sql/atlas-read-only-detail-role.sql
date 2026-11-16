-- Rivet private source contact-card read role.
-- Restricted DEVELOPMENT proof until an independently reviewed login identity
-- and protected credential are provisioned. The role has NO LOGIN and does
-- not expose data via anon, authenticated or service_role HTTP APIs.
-- Apply ONCE to the isolated Rivet development Supabase project only.
BEGIN;
DO $role$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rivet_atlas_detail_reader')
  THEN RAISE EXCEPTION 'atlas detail reader role already exists; review rather than overwrite';
 END IF;
 EXECUTE 'CREATE ROLE rivet_atlas_detail_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS';
END $role$;
GRANT USAGE ON SCHEMA rivet TO rivet_atlas_detail_reader;
-- Every column is explicitly whitelisted. No case notes, inquiry body hashes,
-- outbox records, member roster, task notes, activity history or write rights.
GRANT SELECT(id,contact_id,property_id,kind,stage)
 ON rivet.cases TO rivet_atlas_detail_reader;
GRANT SELECT(id,display_name,email,phone,preferred_reply)
 ON rivet.contacts TO rivet_atlas_detail_reader;
GRANT SELECT(id,submitted_address,city,state,postal_code)
 ON rivet.properties TO rivet_atlas_detail_reader;
GRANT SELECT(id,case_id,reply_consent,consent_version)
 ON rivet.inquiries TO rivet_atlas_detail_reader;

CREATE POLICY atlas_detail_read_cases ON rivet.cases
 FOR SELECT TO rivet_atlas_detail_reader USING (true);
CREATE POLICY atlas_detail_read_contacts ON rivet.contacts
 FOR SELECT TO rivet_atlas_detail_reader USING (true);
CREATE POLICY atlas_detail_read_properties ON rivet.properties
 FOR SELECT TO rivet_atlas_detail_reader USING (true);
CREATE POLICY atlas_detail_read_inquiries ON rivet.inquiries
 FOR SELECT TO rivet_atlas_detail_reader USING (true);
COMMIT;

-- These RLS policies apply ONLY to the explicitly named NOLOGIN DB role.
-- They intentionally do not add authorization for Supabase browser roles.
-- The private backend must verify IWCO staff business grants BEFORE signing
-- each narrowly scoped leadRef + inquiryRef request. The Rivet service must
-- authenticate that signature and execute only parameterized case joins.
-- A production login role, audited read trail and endpoint deployment require
-- separate review; this migration grants no role membership to any login.
