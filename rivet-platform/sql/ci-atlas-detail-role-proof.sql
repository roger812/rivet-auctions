-- Disposable CI DB only; run AFTER atlas-read-only-detail-role.sql.
DO $checks$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rivet_atlas_detail_reader'
  AND rolcanlogin=false AND rolbypassrls=false AND rolcreaterole=false)
  THEN RAISE EXCEPTION 'source reader role is not non-login/least-privileged';END IF;
 IF NOT has_column_privilege('rivet_atlas_detail_reader','rivet.contacts','display_name','SELECT')
 OR NOT has_column_privilege('rivet_atlas_detail_reader','rivet.contacts','email','SELECT')
 OR NOT has_column_privilege('rivet_atlas_detail_reader','rivet.cases','stage','SELECT')
 OR NOT has_column_privilege('rivet_atlas_detail_reader','rivet.inquiries','reply_consent','SELECT')
 THEN RAISE EXCEPTION 'required read-only contact fields inaccessible';END IF;
 IF has_column_privilege('rivet_atlas_detail_reader','rivet.cases','intake_note','SELECT')
 OR has_column_privilege('rivet_atlas_detail_reader','rivet.properties','note','SELECT')
 OR has_table_privilege('rivet_atlas_detail_reader','rivet.lead_outbox','SELECT')
 OR has_table_privilege('rivet_atlas_detail_reader','rivet.contacts','INSERT')
 OR has_table_privilege('rivet_atlas_detail_reader','rivet.cases','UPDATE')
 OR has_table_privilege('anon','rivet.contacts','SELECT')
 OR has_table_privilege('authenticated','rivet.contacts','SELECT')
 THEN RAISE EXCEPTION 'excessive role privileges';END IF;
END $checks$;

-- Use a transaction for all fictional fixtures and always roll back.
BEGIN;
INSERT INTO rivet.contacts(id,display_name,email,preferred_reply)
 VALUES('10000000-0000-4000-8000-000000000001','Fictional Role Proof',
 'fictional-role@example.invalid','email');
INSERT INTO rivet.properties(id,submitted_address,state)
 VALUES('10000000-0000-4000-8000-000000000002','123 Fictional Street','TX');
INSERT INTO rivet.cases(id,contact_id,property_id,kind,source)
 VALUES('10000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002','seller','test');
INSERT INTO rivet.inquiries(id,case_id,request_key,body_hash,reply_consent,consent_version)
 VALUES('10000000-0000-4000-8000-000000000004',
 '10000000-0000-4000-8000-000000000003',
 'ci-detail-role-proof-20261116',repeat('a',64),true,'v1');
SET LOCAL ROLE rivet_atlas_detail_reader;
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*)::int INTO n FROM rivet.cases c
 JOIN rivet.inquiries i ON i.case_id=c.id
 JOIN rivet.contacts ct ON ct.id=c.contact_id
 LEFT JOIN rivet.properties p ON p.id=c.property_id
 WHERE c.id='10000000-0000-4000-8000-000000000003'
  AND i.id='10000000-0000-4000-8000-000000000004';
 IF n<>1 THEN RAISE EXCEPTION 'minimal source join invisible under read role';END IF;
END $check$;
RESET ROLE;
ROLLBACK;
SELECT 'passed' AS atlas_rivet_private_detail_read_role_proof;
