-- Rivet Auctions: scoped metadata-outbox relay identity, default OFF.
-- Login is created WITHOUT a password and cannot connect until a protected
-- secret is explicitly installed by the release engineer.
-- The role can read only metadata outbox rows and case id/source; no contacts,
-- personal property details, conversations, notes, or private staff records.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rivet_atlas_relay_login') THEN
  CREATE ROLE rivet_atlas_relay_login LOGIN NOINHERIT NOSUPERUSER
   NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
 END IF;
END $$;
GRANT USAGE ON SCHEMA rivet TO rivet_atlas_relay_login;
GRANT SELECT (id,source) ON rivet.cases TO rivet_atlas_relay_login;
GRANT SELECT (event_id,case_id,event_type,idempotency_key,payload,delivery_status,
 attempts,created_at,delivered_at,next_attempt_at,lease_owner,lease_expires_at,last_error_code)
 ON rivet.lead_outbox TO rivet_atlas_relay_login;
GRANT UPDATE (delivery_status,attempts,delivered_at,next_attempt_at,
 lease_owner,lease_expires_at,last_error_code)
 ON rivet.lead_outbox TO rivet_atlas_relay_login;
CREATE POLICY rivet_atlas_relay_case_source_20261118 ON rivet.cases
 FOR SELECT TO rivet_atlas_relay_login USING (true);
CREATE POLICY rivet_atlas_relay_outbox_select_20261118 ON rivet.lead_outbox
 FOR SELECT TO rivet_atlas_relay_login USING (true);
CREATE POLICY rivet_atlas_relay_outbox_update_20261118 ON rivet.lead_outbox
 FOR UPDATE TO rivet_atlas_relay_login USING (true) WITH CHECK (true);
-- No LOGIN password, worker service, timer, outbox mutation or outbound request
-- is created by this permission-scoping migration.
