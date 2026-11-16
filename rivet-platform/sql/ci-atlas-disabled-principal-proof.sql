-- Disposable PostgreSQL verification of the disabled Rivet service identity.
-- Requires private schema, read-only role, then disabled-principal migration.
DO $guards$
DECLARE p record;
BEGIN
 SELECT rolcanlogin,rolbypassrls,rolcreatedb,rolcreaterole,rolsuper,rolconnlimit
 INTO p FROM pg_roles WHERE rolname='rivet_atlas_detail_login';
 IF NOT FOUND OR p.rolcanlogin OR p.rolbypassrls OR p.rolcreatedb
   OR p.rolcreaterole OR p.rolsuper OR p.rolconnlimit<>2 THEN
   RAISE EXCEPTION 'service_identity_not_inert';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_auth_members m
   WHERE m.roleid='rivet_atlas_detail_reader'::regrole
     AND m.member='rivet_atlas_detail_login'::regrole
     AND m.inherit_option=true AND m.set_option=false AND m.admin_option=false
 ) THEN RAISE EXCEPTION 'reader_membership_not_limited'; END IF;
 IF NOT has_schema_privilege('rivet_atlas_detail_login','rivet','USAGE')
    OR NOT has_column_privilege('rivet_atlas_detail_login','rivet.contacts','email','SELECT')
    OR NOT has_column_privilege('rivet_atlas_detail_login','rivet.inquiries','reply_consent','SELECT')
    OR has_column_privilege('rivet_atlas_detail_login','rivet.cases','intake_note','SELECT')
    OR has_column_privilege('rivet_atlas_detail_login','rivet.properties','note','SELECT')
    OR has_table_privilege('rivet_atlas_detail_login','rivet.lead_outbox','SELECT')
    OR has_table_privilege('rivet_atlas_detail_login','rivet.contacts','INSERT')
    OR has_table_privilege('rivet_atlas_detail_login','rivet.cases','UPDATE')
 THEN RAISE EXCEPTION 'excessive_or_missing_principal_access'; END IF;
END $guards$;

-- One fictional join using the exact RLS-applicable service role.
BEGIN;
INSERT INTO rivet.contacts(id,display_name,email,preferred_reply)
 VALUES('10000000-0000-4000-8000-000000001011',
        'Fictional Principal','principal@example.invalid','email');
INSERT INTO rivet.cases(id,contact_id,kind,source)
 VALUES('10000000-0000-4000-8000-000000001012',
        '10000000-0000-4000-8000-000000001011','seller','test');
INSERT INTO rivet.inquiries(id,case_id,request_key,body_hash,reply_consent,consent_version)
 VALUES('10000000-0000-4000-8000-000000001013',
        '10000000-0000-4000-8000-000000001012',
        'test-principal-20261116',repeat('c',64),true,'test');
SET LOCAL ROLE rivet_atlas_detail_login;
DO $reader$
DECLARE result_count integer;
BEGIN
 SELECT count(*)::int INTO result_count FROM rivet.cases c
 JOIN rivet.inquiries i ON i.case_id=c.id
 JOIN rivet.contacts ct ON ct.id=c.contact_id
 LEFT JOIN rivet.properties p ON p.id=c.property_id
 WHERE c.id='10000000-0000-4000-8000-000000001012'
   AND i.id='10000000-0000-4000-8000-000000001013';
 IF result_count<>1 THEN RAISE EXCEPTION 'principal_cannot_read_exact_case'; END IF;
END $reader$;
RESET ROLE;
ROLLBACK;
SELECT 'passed' AS inactive_reader_principal_proof;
