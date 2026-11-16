/**
 * Real-node / real-Postgres integration proof for an isolated disposable CI DB.
 *
 * NOT for production, NEVER uses Supabase credentials. CI only passes fictional
 * inputs and always wraps the proof in an outer rollback transaction.
 *
 * Usage:
 *   RIVET_CI_PROOF=1 PGHOST=127.0.0.1 PGUSER=postgres \
 *   PGPASSWORD=fixture-only PGDATABASE=rivet_ci node integration/ci-postgres-proof.mjs
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createRivetPostgresRepository} from '../src/postgres-repository.mjs';
import {createRivetPublicIntake} from '../src/public-intake.mjs';

const {Pool} = pg;
const origin = 'https://rivet-ci.invalid';
const idKey = 'rivet-integration-' + randomUUID().replaceAll('-','');
const inquiryName = 'Fictional Rivet CI ' + randomUUID().slice(0,8);
const fictional = Object.freeze({
  kind: 'seller',
  name: inquiryName,
  email: 'fictional-owner@example.invalid',
  propertyAddress: '123 Imaginary Lane',
  city: 'Austin',
  state: 'TX',
  preferredReply: 'email',
  source: 'test',
  consentToReply: true
});

function makePoolFacade(client, breakOutbox = false) {
  return {
    async connect() {
      return {
        async query(sql, args = []) {
          // Repository thinks it owns a transaction. CI owns the outer one.
          if (sql === 'BEGIN') return client.query('SAVEPOINT rivet_ci_intake');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT rivet_ci_intake');
          if (sql === 'ROLLBACK') {
            await client.query('ROLLBACK TO SAVEPOINT rivet_ci_intake');
            return client.query('RELEASE SAVEPOINT rivet_ci_intake');
          }
          if (breakOutbox && sql.startsWith('INSERT INTO rivet.lead_outbox'))
            throw new Error('ci_injected_outbox_fault');
          return client.query(sql, args);
        },
        release() { /* Outer transaction owns client. */ }
      };
    },
    query(sql, args = []) { return client.query(sql, args); }
  };
}

function request(key, override = {}) {
  return new Request(origin + '/api/inquiries', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': key
    },
    body: JSON.stringify({...fictional, ...override})
  });
}

function endpoint(facade) {
  return createRivetPublicIntake({
    origin,
    repository: createRivetPostgresRepository({pool: facade}),
    // Synthetic adapters are allowed in this isolated test only.
    verifyHuman: async () => true,
    rateLimiter: async () => true
  });
}

async function uniqueCount(client, table, column, value) {
  const allowed = {
    contacts: new Set(['id','display_name']),
    properties: new Set(['id']),
    cases: new Set(['id']),
    inquiries: new Set(['id']),
    tasks: new Set(['case_id']),
    activities: new Set(['case_id']),
    lead_outbox: new Set(['case_id'])
  };
  if (!allowed[table]?.has(column)) throw new TypeError('unsafe_ci_check');
  const q = await client.query(
    'SELECT count(*)::integer AS n FROM rivet.' + table + ' WHERE ' + column + ' = $1',
    [value]
  );
  return q.rows[0].n;
}

async function run() {
  if (process.env.RIVET_CI_PROOF !== '1' ||
      !['127.0.0.1','localhost'].includes(process.env.PGHOST || '') ||
      process.env.PGDATABASE !== 'rivet_ci')
    throw new Error('disposable_local_ci_database_only');

  const pool = new Pool({max:1, connectionTimeoutMillis:8000});
  const client = await pool.connect();
  let outerStarted = false;
  let receipt = null;
  try {
    await client.query('BEGIN');
    outerStarted = true;
    const send = endpoint(makePoolFacade(client));
    const first = await send(request(idKey));
    assert.equal(first.status,201);
    const firstBody = await first.json();
    assert.equal(firstBody.replayed,false);
    receipt = firstBody.reference;
    const linked = await client.query(
      'SELECT c.id AS case_id, c.contact_id, c.property_id, o.event_type, o.payload, ' +
      'o.delivery_status FROM rivet.inquiries i ' +
      'JOIN rivet.cases c ON c.id=i.case_id ' +
      'JOIN rivet.lead_outbox o ON o.case_id=c.id WHERE i.id=$1',
      [receipt]
    );
    assert.equal(linked.rowCount,1,'inquiry/case/outbox join missing');
    const row = linked.rows[0];
    assert.equal(row.event_type,'lead.received');
    assert.equal(row.delivery_status,'pending');
    assert.equal(row.payload.businessId,'rivet-auctions');
    assert.equal(row.payload.leadType,'auction-seller-inquiry');
    assert.equal(row.payload.security.containsCustomerPII,false);
    assert.ok(!JSON.stringify(row.payload).includes(inquiryName));

    for (const [table,column,value] of [
      ['contacts','id',row.contact_id],['properties','id',row.property_id],
      ['cases','id',row.case_id],['inquiries','id',receipt],
      ['tasks','case_id',row.case_id],['activities','case_id',row.case_id],
      ['lead_outbox','case_id',row.case_id]
    ]) assert.equal(await uniqueCount(client,table,column,value),1,'missing '+table);

    const replay = await send(request(idKey));
    assert.equal(replay.status,200);
    assert.deepEqual(await replay.json(),{reference:receipt,status:'received',replayed:true});
    assert.equal(await uniqueCount(client,'lead_outbox','case_id',row.case_id),1);

    const changed = await send(request(idKey,{note:'Changed payload'}));
    assert.equal(changed.status,409,'same key with different body must fail');
    assert.equal(await uniqueCount(client,'lead_outbox','case_id',row.case_id),1);

    const failed = await endpoint(makePoolFacade(client,true))(
      request(idKey+'-fault',{name:'Fictional Error Fixture'})
    );
    assert.equal(failed.status,503);
    assert.equal(await uniqueCount(client,'contacts','display_name','Fictional Error Fixture'),0);

    const permissions = await client.query(
      "SELECT NOT has_schema_privilege('anon','rivet','USAGE') AS anon_blocked, " +
      "NOT has_schema_privilege('authenticated','rivet','USAGE') AS user_blocked, " +
      "(SELECT bool_and(relrowsecurity) FROM pg_class c " +
      " JOIN pg_namespace n ON n.oid=c.relnamespace " +
      " WHERE n.nspname='rivet' AND c.relkind='r') AS all_rls"
    );
    assert.equal(permissions.rows[0].anon_blocked,true);
    assert.equal(permissions.rows[0].user_blocked,true);
    assert.equal(permissions.rows[0].all_rls,true);
    process.stdout.write('PASS: Rivet Node intake -> actual Postgres -> private outbox; ' +
      'replay/conflict/rollback/permissions\n');
  } finally {
    if (outerStarted) await client.query('ROLLBACK').catch(() => {});
    if (receipt) {
      const leftover = await client.query('SELECT count(*)::integer AS n FROM rivet.inquiries WHERE id=$1',[receipt]);
      assert.equal(leftover.rows[0].n,0,'CI fixture unexpectedly persisted');
    }
    client.release();
    await pool.end();
  }
}

run().catch(error => {
  // No server/database errors or connection values should be printed by CI.
  console.error('Rivet CI database proof failed:', error?.code || error?.name || 'unknown');
  process.exitCode=1;
});
