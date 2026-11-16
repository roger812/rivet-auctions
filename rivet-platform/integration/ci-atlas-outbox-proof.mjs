/**
 * Disposable CI PostgreSQL integration proof for the real Rivet delivery worker.
 * Uses a mocked HTTP destination, NOT the production IWCO receiver.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createRivetAtlasOutboxWorker} from '../src/atlas-outbox-worker.mjs';
import {makeRivetAuctionLeadEnvelope} from '../src/atlas-lead-envelope.mjs';

const {Pool}=pg;

async function makeEvent(pool,label) {
 const contactId=randomUUID(),caseId=randomUUID(),inquiryId=randomUUID(),eventId=randomUUID();
 const client=await pool.connect();
 const envelope=makeRivetAuctionLeadEnvelope({
  receipt:{caseId,id:inquiryId},
  inquiry:{kind:'seller',source:'google',consentToReply:true}
 });
 try {
  await client.query('BEGIN');
  await client.query(
   'INSERT INTO rivet.contacts (id,display_name,email,preferred_reply) VALUES ($1,$2,$3,$4)',
   [contactId,'Fictional '+label,'fictional@example.invalid','email']
  );
  await client.query(
   'INSERT INTO rivet.cases (id,contact_id,kind,source) VALUES ($1,$2,$3,$4)',
   [caseId,contactId,'seller','test']
  );
  await client.query(
   'INSERT INTO rivet.inquiries (id,case_id,request_key,body_hash,reply_consent,consent_version) '+
   'VALUES ($1,$2,$3,$4,$5,$6)',
   [inquiryId,caseId,'ci-test-'+randomUUID().replaceAll('-',''), 'a'.repeat(64),true,'ci-test-only']
  );
  await client.query(
   'INSERT INTO rivet.lead_outbox (event_id,case_id,event_type,idempotency_key,payload) '+
   'VALUES ($1,$2,$3,$4,$5)',
   [eventId,caseId,'lead.received',envelope.idempotencyKey,envelope]
  );
  await client.query('COMMIT');
 } catch(error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {client.release();}
 return {eventId,caseId,envelope};
}

async function readRow(pool,eventId) {
 const r=await pool.query(
  'SELECT delivery_status,attempts,lease_owner,lease_expires_at,delivered_at,last_error_code '+
  'FROM rivet.lead_outbox WHERE event_id=$1',[eventId]
 );
 assert.equal(r.rowCount,1);
 return r.rows[0];
}

async function main() {
 if(process.env.RIVET_CI_PROOF!=='1' ||
    !['127.0.0.1','localhost'].includes(process.env.PGHOST||'') ||
    process.env.PGDATABASE!=='rivet_ci')
  throw new Error('only_disposable_ci_database_allowed');
 const pool=new Pool({max:3,connectionTimeoutMillis:8000});
 try {
  let calls=0;
  const first=await makeEvent(pool,'Retry Case');
  const sender={enabled:true,async deliver(event){
   assert.equal(event.businessId,'rivet-auctions');
   assert.equal(event.leadRef,first.caseId);
   calls++;
   if(calls===1) {
    const error=new Error('fake_unavailable');
    error.code='rivet_atlas_destination_unavailable';
    throw error;
   }
   return {delivered:true,replayed:true,leadRef:event.leadRef};
  }};
  const worker=createRivetAtlasOutboxWorker({pool,sender});
  assert.deepEqual(await worker.runOnce(),
   {status:'retry',attempts:1,errorCode:'rivet_atlas_destination_unavailable'});
  let row=await readRow(pool,first.eventId);
  assert.equal(row.delivery_status,'retry');
  assert.equal(row.attempts,1);
  assert.equal(row.lease_owner,null);
  assert.equal(row.last_error_code,'rivet_atlas_destination_unavailable');
  await pool.query(
   'UPDATE rivet.lead_outbox SET next_attempt_at=now()-interval \'1 second\' WHERE event_id=$1',
   [first.eventId]
  );
  assert.deepEqual(await worker.runOnce(),{status:'delivered',attempts:2,replayed:true});
  row=await readRow(pool,first.eventId);
  assert.equal(row.delivery_status,'delivered');
  assert.equal(row.attempts,2);
  assert.equal(row.lease_owner,null);
  assert.ok(row.delivered_at);
  assert.equal(calls,2);

  // Simulate a worker crash. An expired processing lease can be reclaimed.
  const second=await makeEvent(pool,'Expired Lease');
  await pool.query(
   "UPDATE rivet.lead_outbox SET delivery_status='processing',"+
   "lease_owner=$2,lease_expires_at=now()-interval '1 second',attempts=1 "+
   'WHERE event_id=$1',[second.eventId,randomUUID()]
  );
  const recovered=createRivetAtlasOutboxWorker({
   pool,sender:{enabled:true,async deliver(event){
    assert.equal(event.leadRef,second.caseId);
    return {delivered:true,replayed:false};
   }}
  });
  assert.deepEqual(await recovered.runOnce(),{status:'delivered',attempts:2,replayed:false});
  assert.equal((await readRow(pool,second.eventId)).delivery_status,'delivered');

  // After the budget, the event is paused rather than repeatedly sent.
  const third=await makeEvent(pool,'Exhausted Retry');
  await pool.query(
   'UPDATE rivet.lead_outbox SET attempts=8 WHERE event_id=$1',[third.eventId]
  );
  let extraCalls=0;
  const paused=createRivetAtlasOutboxWorker({
   pool,sender:{enabled:true,async deliver(){extraCalls++;return {delivered:true};}}
  });
  assert.deepEqual(await paused.runOnce(),{status:'paused'});
  assert.equal(extraCalls,0);
  assert.equal((await readRow(pool,third.eventId)).delivery_status,'paused');

  assert.deepEqual(await paused.runOnce(),{status:'idle'});
  const roles=await pool.query(
   "SELECT NOT has_table_privilege('anon','rivet.lead_outbox','SELECT') AS anon_blocked, "+
   "NOT has_table_privilege('authenticated','rivet.lead_outbox','SELECT') AS staff_blocked"
  );
  assert.equal(roles.rows[0].anon_blocked,true);
  assert.equal(roles.rows[0].staff_blocked,true);
  process.stdout.write('PASS: Rivet real PostgreSQL outbox worker retries, recovers, pauses; no external network\n');
 } finally {
  await pool.end();
 }
}
main().catch(error=>{
 console.error('Rivet outbox integration proof failed:',error?.code||error?.name||'unknown');
 process.exitCode=1;
});
