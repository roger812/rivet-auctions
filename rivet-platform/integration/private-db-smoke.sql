-- Rivet Auctions: reversible real-Postgres schema smoke test.
-- Ran against Supabase rivet-auctions-development on 2026-11-16.
-- Run ONLY on the isolated Rivet development project through a privileged,
-- trusted SQL editor or backend connection. Never from a web browser.
-- No real customers, no persistent test records, no cross-business network sync.
-- This validates actual DB constraints, NOT the Node repository/HTTP path.

DO $test$
DECLARE
 c uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); k uuid:=gen_random_uuid();
 i uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); badc uuid:=gen_random_uuid();
 badk uuid:=gen_random_uuid(); rk text:='rivet-test-'||replace(gen_random_uuid()::text,'-','');
 ek text; ep jsonb; n integer:=0; injected boolean:=false;
BEGIN
 ek:='rivet-auctions:lead.received:'||k::text;
 ep:=jsonb_build_object('schemaVersion',1,'businessId','rivet-auctions',
  'sourceSystem','rivet-auctions','eventType','lead.received','leadRef',k::text,
  'inquiryRef',i::text,'leadType','auction-seller-inquiry',
  'security',jsonb_build_object('containsCustomerPII',false));
 BEGIN
  INSERT INTO rivet.contacts(id,display_name,email,preferred_reply)
   VALUES(c,'Fictional Owner','fictional@example.invalid','email');
  INSERT INTO rivet.properties(id,submitted_address,city,state)
   VALUES(p,'123 Fictional Lane','Austin','TX');
  INSERT INTO rivet.cases(id,contact_id,property_id,kind,source,stage)
   VALUES(k,c,p,'seller','test','New');
  INSERT INTO rivet.inquiries(id,case_id,request_key,body_hash,reply_consent,consent_version)
   VALUES(i,k,rk,repeat('a',64),true,'rivet-reply-v1');
  INSERT INTO rivet.tasks(id,case_id,action,status)
   VALUES(gen_random_uuid(),k,'Review fictional inquiry','open');
  INSERT INTO rivet.activities(id,case_id,kind,detail)
   VALUES(gen_random_uuid(),k,'inquiry_received','{"kind":"seller","source":"test"}');
  INSERT INTO rivet.lead_outbox(event_id,case_id,event_type,idempotency_key,payload,delivery_status)
   VALUES(e,k,'lead.received',ek,ep,'pending');
  IF (SELECT count(*) FROM rivet.contacts WHERE id=c)<>1 OR
     (SELECT count(*) FROM rivet.properties WHERE id=p)<>1 OR
     (SELECT count(*) FROM rivet.cases WHERE id=k)<>1 OR
     (SELECT count(*) FROM rivet.inquiries WHERE id=i)<>1 OR
     (SELECT count(*) FROM rivet.tasks WHERE case_id=k)<>1 OR
     (SELECT count(*) FROM rivet.activities WHERE case_id=k)<>1 OR
     (SELECT count(*) FROM rivet.lead_outbox WHERE case_id=k)<>1
  THEN RAISE EXCEPTION 'transaction missing related records'; END IF;
  -- A replay cannot create a second intake or lead index event.
  INSERT INTO rivet.inquiries(id,case_id,request_key,body_hash,reply_consent,consent_version)
   VALUES(gen_random_uuid(),k,rk,repeat('a',64),true,'rivet-reply-v1')
   ON CONFLICT(request_key) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'duplicate inquiry accepted'; END IF;
  INSERT INTO rivet.lead_outbox(event_id,case_id,event_type,idempotency_key,payload)
   VALUES(gen_random_uuid(),k,'lead.received',ek,ep)
   ON CONFLICT(idempotency_key) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'duplicate outbox event accepted'; END IF;
  -- PL/pgSQL exception subtransaction rolls back all fictional writes.
  RAISE EXCEPTION USING ERRCODE='RV001',MESSAGE='intentional rollback';
 EXCEPTION WHEN SQLSTATE 'RV001' THEN
  IF EXISTS(SELECT 1 FROM rivet.contacts WHERE id=c) OR
     EXISTS(SELECT 1 FROM rivet.cases WHERE id=k) OR
     EXISTS(SELECT 1 FROM rivet.inquiries WHERE id=i) OR
     EXISTS(SELECT 1 FROM rivet.lead_outbox WHERE event_id=e)
  THEN RAISE EXCEPTION 'fictional records persisted'; END IF;
 END;
 BEGIN
  INSERT INTO rivet.contacts(id,display_name,email,preferred_reply)
   VALUES(badc,'Fictional Failure','failure@example.invalid','email');
  INSERT INTO rivet.cases(id,contact_id,kind,source,stage)
   VALUES(badk,badc,'seller','test','New');
  injected:=true;
  -- Invalid business ID must fail and roll back earlier inserts.
  INSERT INTO rivet.lead_outbox(event_id,case_id,event_type,idempotency_key,payload)
   VALUES(gen_random_uuid(),badk,'lead.received','rivet-auctions:lead.received:'||badk::text,
    jsonb_build_object('schemaVersion',1,'businessId','wrong-business',
      'eventType','lead.received','leadRef',badk::text));
  RAISE EXCEPTION 'invalid outbox unexpectedly accepted';
 EXCEPTION WHEN check_violation THEN
  IF NOT injected THEN RAISE EXCEPTION 'failure occurred before outbox'; END IF;
  IF EXISTS(SELECT 1 FROM rivet.contacts WHERE id=badc) OR
     EXISTS(SELECT 1 FROM rivet.cases WHERE id=badk)
  THEN RAISE EXCEPTION 'failure rollback left partial records'; END IF;
 END;
END $test$;

-- Expected in the initial empty development project:
-- 'passed', zero records in all four counts, both access gates true.
SELECT 'passed' AS schema_proof,
 (SELECT count(*) FROM rivet.contacts) AS contacts,
 (SELECT count(*) FROM rivet.cases) AS cases,
 (SELECT count(*) FROM rivet.inquiries) AS inquiries,
 (SELECT count(*) FROM rivet.lead_outbox) AS outbox,
 NOT has_schema_privilege('anon','rivet','USAGE') AS anon_denied,
 NOT has_schema_privilege('authenticated','rivet','USAGE') AS ordinary_users_denied;
