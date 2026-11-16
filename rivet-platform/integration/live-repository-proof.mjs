/**
 * CONTROLLED RIVET DEVELOPMENT INTEGRATION PROOF — NOT A WEB SERVER.
 *
 * Exercises the actual public intake handler + repository + private database,
 * but holds an OUTER transaction open and always rolls it back. Inbound data
 * and lead-outbox events remain fictional and never become visible to workers.
 *
 * Requires a private backend environment with a verified certificate:
 *   RIVET_DEV_DB_PROOF=I_ACKNOWLEDGE_DEV_ONLY
 *   RIVET_DEV_DATABASE_URL=<Rivet Supabase dev Postgres connection URI>
 *   RIVET_DEV_DB_CA_PEM=<project root CA PEM>
 * And node-postgres (pg) installed in that backend environment.
 *
 * No credentials or CA should ever be committed or copied into ChatGPT.
 * This file does not connect to, read, or modify IWCO.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRivetPostgresRepository} from '../src/postgres-repository.mjs';
import {createRivetPublicIntake} from '../src/public-intake.mjs';
import {createRivetDevelopmentPool} from '../src/server-db.mjs';

const origin = 'https://rivet-proof.invalid';
const testCaseName = 'Fictional Rivet Proof ' + randomUUID().slice(0,8);
const key = 'rivet-proof-' + randomUUID().replace(/-/g,'');
const body = Object.freeze({
  kind:'seller', name:testCaseName, email:'rivet-proof@example.invalid',
  propertyAddress:'123 Fictional Lane', city:'Austin', state:'TX',
  preferredReply:'email', source:'test', consentToReply:true
});

function savepointAdapter(client, {breakOutbox=false} = {}) {
  return {
    async connect() {
      return {
        async query(sql, params = []) {
          if (sql === 'BEGIN') return client.query('SAVEPOINT rivet_proof_write');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT rivet_proof_write');
          if (sql === 'ROLLBACK') {
            await client.query('ROLLBACK TO SAVEPOINT rivet_proof_write');
            return client.query('RELEASE SAVEPOINT rivet_proof_write');
          }
          if (breakOutbox && sql.startsWith('INSERT INTO rivet.lead_outbox'))
            throw new Error('simulated_outbox_failure');
          return client.query(sql, params);
        },
        release() {} // The outer test transaction owns this dedicated client.
      };
    },
    async query(sql, params) { return client.query(sql, params); }
  };
}

function request(requestKey, extra = {}) {
  return new Request(origin + '/api/inquiries', {
    method:'POST',
    headers:{
      Origin:origin,
      'Content-Type':'application/json',
      'Idempotency-Key':requestKey
    },
    body:JSON.stringify({...body, ...extra})
  });
}

function handler(database) {
  return createRivetPublicIntake({
    origin,
    repository:createRivetPostgresRepository({pool:database}),
    // These are test-only gates, NEVER valid production adapters.
    verifyHuman:async()=>true,
    rateLimiter:async()=>true
  });
}

async function count(client, table, column, value) {
  const allowed = new Set(['contacts','properties','cases','inquiries','tasks','activities','lead_outbox']);
  const columns = new Set(['id','case_id','display_name','request_key']);
  if (!allowed.has(table) || !columns.has(column)) throw new TypeError('test_query_invalid');
  const result = await client.query(
    'SELECT count(*)::integer AS n FROM rivet.' + table + ' WHERE ' + column + '=$1', [value]
  );
  return result.rows[0].n;
}

async function main() {
  if (process.env.RIVET_DEV_DB_PROOF !== 'I_ACKNOWLEDGE_DEV_ONLY')
    throw new Error('explicit_private_dev_test_opt_in_required');

  // The Pool is loaded only after the opt-in check, and never in the browser.
  const {Pool} = await import('pg');
  const pool = createRivetDevelopmentPool({
    Pool,
    connectionString:process.env.RIVET_DEV_DATABASE_URL,
    caCertificate:process.env.RIVET_DEV_DB_CA_PEM
  });
  const client = await pool.connect();
  let started = false;
  let receiptId = null;
  try {
    await client.query('BEGIN');
    started = true;
    const send = handler(savepointAdapter(client));
    const first = await send(request(key));
    assert.equal(first.status,201);
    const firstPayload = await first.json();
    assert.equal(firstPayload.status,'received');
    assert.equal(firstPayload.replayed,false);
    receiptId = firstPayload.reference;

    const result = await client.query('SELECT case_id FROM rivet.inquiries WHERE id=$1',[receiptId]);
    assert.equal(result.rowCount,1);
    const caseId = result.rows[0].case_id;

    const verify = await client.query(
      'SELECT c.contact_id,c.property_id,o.event_type,o.payload FROM rivet.cases c ' +
      'JOIN rivet.lead_outbox o ON o.case_id=c.id WHERE c.id=$1', [caseId]
    );
    assert.equal(verify.rowCount,1);
    const {contact_id,property_id,event_type,payload} = verify.rows[0];
    assert.equal(event_type,'lead.received');
    assert.equal(payload.businessId,'rivet-auctions');
    assert.equal(payload.leadType,'auction-seller-inquiry');
    assert.equal(payload.security.containsCustomerPII,false);
    assert.ok(!JSON.stringify(payload).includes(testCaseName));

    for (const [table,column,value] of [
      ['contacts','id',contact_id],['properties','id',property_id],
      ['cases','id',caseId],['inquiries','id',receiptId],
      ['tasks','case_id',caseId],['activities','case_id',caseId],
      ['lead_outbox','case_id',caseId]
    ]) assert.equal(await count(client,table,column,value),1,table+' missing');

    const replay = await send(request(key));
    assert.equal(replay.status,200);
    const replayPayload = await replay.json();
    assert.equal(replayPayload.replayed,true);
    assert.equal(replayPayload.reference,receiptId);
    assert.equal(await count(client,'inquiries','id',receiptId),1);

    const conflicting = await send(request(key,{note:'Changed request'}));
    assert.equal(conflicting.status,409);
    assert.equal(await count(client,'lead_outbox','case_id',caseId),1);

    // Force a failure at the final outbox write: no partial contact/case may survive.
    const failed = await handler(savepointAdapter(client,{breakOutbox:true}))(
      request(key+'-failure',{name:'Fictional Fault Injection'})
    );
    assert.equal(failed.status,503);
    assert.equal(await count(client,'contacts','display_name','Fictional Fault Injection'),0);

    const rights = await client.query(
      "SELECT NOT has_schema_privilege('anon','rivet','USAGE') AS anon_blocked, " +
      "NOT has_schema_privilege('authenticated','rivet','USAGE') AS authenticated_blocked"
    );
    assert.equal(rights.rows[0].anon_blocked,true);
    assert.equal(rights.rows[0].authenticated_blocked,true);
    console.log('PASS: actual Rivet intake -> PG -> outbox; replay, conflict, rollback and private permissions');
  } finally {
    if (started) await client.query('ROLLBACK').catch(()=>{});
    if (receiptId) {
      const leftover = await client.query('SELECT count(*)::integer AS n FROM rivet.inquiries WHERE id=$1',[receiptId]);
      assert.equal(leftover.rows[0].n,0,'test record leaked beyond outer rollback');
    }
    client.release();
    await pool.end();
  }
}

main().catch(error=>{
  // Avoid accidentally echoing connection credentials or raw database errors.
  console.error('Rivet private DB integration proof failed:', error?.code || error?.name || 'unknown');
  process.exitCode=1;
});
