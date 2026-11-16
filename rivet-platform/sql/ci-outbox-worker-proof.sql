-- Disposable PostgreSQL CI only. No Supabase or IWCO credentials.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
\ir initial-schema.sql
\ir lead-outbox.sql
\ir lead-outbox-worker.sql

DO $test$
DECLARE
 contact uuid:='2f4c824e-c10a-4d82-9144-7ac4a622e21b';
 case_ref uuid:='7c702cb9-9ee1-4bde-bb80-05ad2987c813';
 event_ref uuid:='c76407fe-b730-4194-99f6-e87bcf65b543';
 lease_ref uuid:='eae89180-0526-4ee7-bb4e-e5192ef7db92';
 row_count integer;
BEGIN
 INSERT INTO rivet.contacts(id,display_name,email,preferred_reply)
 VALUES(contact,'Fictional CI','ci@example.invalid','email');
 INSERT INTO rivet.cases(id,contact_id,kind,source)
 VALUES(case_ref,contact,'seller','test');
 INSERT INTO rivet.lead_outbox(event_id,case_id,event_type,idempotency_key,payload)
 VALUES(event_ref,case_ref,'lead.received','rivet-auctions:lead.received:'||case_ref::text,
 jsonb_build_object('schemaVersion',1,'eventType','lead.received',
 'businessId','rivet-auctions','leadRef',case_ref::text));
 IF NOT EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=event_ref
  AND delivery_status='pending' AND attempts=0
  AND lease_owner IS NULL AND next_attempt_at IS NOT NULL)
 THEN RAISE EXCEPTION 'new events not claimable'; END IF;
 UPDATE rivet.lead_outbox SET delivery_status='processing',
  lease_owner=lease_ref,lease_expires_at=now()+interval '30 seconds',
  attempts=attempts+1 WHERE event_id=event_ref;
 IF NOT EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=event_ref
  AND delivery_status='processing' AND lease_owner=lease_ref AND attempts=1)
 THEN RAISE EXCEPTION 'lease claim failed'; END IF;
 BEGIN
  UPDATE rivet.lead_outbox SET lease_owner=NULL WHERE event_id=event_ref;
  RAISE EXCEPTION 'missing lease accepted';
 EXCEPTION WHEN check_violation THEN
  IF NOT EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=event_ref AND lease_owner=lease_ref)
   THEN RAISE EXCEPTION 'invalid write damaged lease'; END IF;
 END;
 UPDATE rivet.lead_outbox SET delivery_status='retry',
  lease_owner=NULL,lease_expires_at=NULL,
  next_attempt_at=now()+interval '30 seconds',
  last_error_code='destination_unavailable' WHERE event_id=event_ref;
 IF NOT EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=event_ref
  AND delivery_status='retry' AND lease_owner IS NULL
  AND last_error_code='destination_unavailable')
 THEN RAISE EXCEPTION 'retry lease not cleared'; END IF;
 UPDATE rivet.lead_outbox SET delivery_status='processing',
  lease_owner=lease_ref,lease_expires_at=now()+interval '30 seconds',
  attempts=attempts+1 WHERE event_id=event_ref;
 UPDATE rivet.lead_outbox SET delivery_status='delivered',
  delivered_at=now(),lease_owner=NULL,lease_expires_at=NULL
 WHERE event_id=event_ref AND lease_owner=lease_ref;
 IF NOT EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=event_ref
  AND delivery_status='delivered' AND lease_owner IS NULL AND attempts=2)
 THEN RAISE EXCEPTION 'delivery settlement failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='rivet' AND c.relname='lead_outbox'
  AND c.relrowsecurity)
 THEN RAISE EXCEPTION 'outbox RLS missing'; END IF;
 IF has_table_privilege('anon','rivet.lead_outbox','SELECT') OR
    has_table_privilege('authenticated','rivet.lead_outbox','SELECT')
 THEN RAISE EXCEPTION 'outbox exposed to browser roles'; END IF;
 RAISE NOTICE 'PASS: Rivet lease, retry, final delivery and private outbox';
END $test$;
SELECT 'passed' AS outbox_schema_proof;
