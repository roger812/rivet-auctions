-- Rivet Auctions durable Atlas delivery lease migration. DEVELOPMENT DRAFT.
-- Test in disposable Postgres before applying to the isolated Rivet project.
-- Does not expose customer PII, start workers, or contact IWCO.
BEGIN;
ALTER TABLE rivet.lead_outbox
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN lease_owner uuid,
 ADD COLUMN lease_expires_at timestamptz,
 ADD COLUMN last_error_code text;
ALTER TABLE rivet.lead_outbox
 DROP CONSTRAINT lead_outbox_delivery_status_check;
ALTER TABLE rivet.lead_outbox
 ADD CONSTRAINT lead_outbox_delivery_status_check
 CHECK (delivery_status IN ('pending','processing','delivered','paused','retry'));
ALTER TABLE rivet.lead_outbox
 ADD CONSTRAINT lead_outbox_lease_consistency
 CHECK (
  (delivery_status='processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  OR (delivery_status<>'processing' AND lease_owner IS NULL AND lease_expires_at IS NULL)
 );
ALTER TABLE rivet.lead_outbox
 ADD CONSTRAINT lead_outbox_error_code_bound
 CHECK (last_error_code IS NULL OR (length(last_error_code)<=80 AND last_error_code ~ '^[a-z0-9_]+$'));
CREATE INDEX lead_outbox_claimable ON rivet.lead_outbox(next_attempt_at,created_at,event_id)
 WHERE delivery_status IN ('pending','retry','processing');
-- The existing private schema, RLS and grants remain unchanged.
COMMIT;

-- IMPORTANT: never remove columns on a live active worker.
-- Rollback for an empty, inactive development outbox only:
-- BEGIN;
-- DROP INDEX IF EXISTS rivet.lead_outbox_claimable;
-- ALTER TABLE rivet.lead_outbox DROP CONSTRAINT lead_outbox_lease_consistency;
-- ALTER TABLE rivet.lead_outbox DROP CONSTRAINT lead_outbox_error_code_bound;
-- ALTER TABLE rivet.lead_outbox DROP CONSTRAINT lead_outbox_delivery_status_check;
-- ALTER TABLE rivet.lead_outbox ADD CONSTRAINT lead_outbox_delivery_status_check
-- CHECK (delivery_status IN ('pending','delivered','paused','retry'));
-- ALTER TABLE rivet.lead_outbox DROP COLUMN next_attempt_at,
--  DROP COLUMN lease_owner,DROP COLUMN lease_expires_at,DROP COLUMN last_error_code;
-- COMMIT;
