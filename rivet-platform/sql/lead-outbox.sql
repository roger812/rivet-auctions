-- Development migration. Rivet Auctions private durable events for a future common CRM.
-- Does not create any Atlas CRM, send customer data or alter IWCO.
-- Every enqueue must occur in the SAME transaction as the corresponding case.
CREATE TABLE rivet.lead_outbox (
  event_id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES rivet.cases(id),
  event_type text NOT NULL CHECK (event_type = 'lead.received'),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','delivered','paused','retry')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE (case_id,event_type),
  CHECK (jsonb_typeof(payload)='object'),
  CHECK (payload->>'businessId' = 'rivet-auctions'),
  CHECK (payload->>'eventType' = event_type),
  CHECK (payload->>'leadRef' = case_id::text),
  CHECK ((payload->>'schemaVersion')::integer = 1)
);
CREATE INDEX lead_outbox_unsent
ON rivet.lead_outbox (created_at, event_id)
WHERE delivery_status IN ('pending','retry');
ALTER TABLE rivet.lead_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rivet.lead_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON rivet.lead_outbox TO service_role;
-- No RLS policy intentionally: anonymous/authenticated never access this table.
-- A future server worker must authenticate to the common CRM, retry safely,
-- and use idempotency_key for dedupe. No worker is enabled by this migration.
