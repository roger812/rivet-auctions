import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRivetPostgresRepository, RivetIdempotencyConflict} from '../src/postgres-repository.mjs';

const inquiry = {
  kind:'seller', name:'Sample Owner', email:'owner@example.com', phone:'',
  preferredReply:'email', propertyAddress:'', city:'', state:'TX', postalCode:'',
  note:'Needs repairs', source:'direct', consentToReply:true,
  consentVersion:'rivet-reply-v1'
};
const key = 'request-example-0000000000000001';
const userId = '2abc802e-4b1a-4f74-bc75-4b27c188a1a2';

function mockPool({existing=null, failAt=null, member=null, cases=[]}={}) {
  const log=[];
  let released=false;
  const client={
    async query(sql,args=[]) {
      log.push({sql,args});
      if (sql===failAt) throw Error('database_unavailable');
      if (sql.startsWith('SELECT id, case_id, body_hash FROM')) return {rows:existing ? [existing] : []};
      return {rows:[]};
    },
    release(){released=true;}
  };
  const pool={
    async connect(){return client;},
    async query(sql,args=[]) {
      log.push({sql,args});
      if (sql.startsWith('SELECT active, role FROM')) return {rows:member ? [member] : []};
      if (sql.startsWith('SELECT c.id')) return {rows:cases};
      return {rows:[]};
    }
  };
  return {repo:createRivetPostgresRepository({pool}),log,get released(){return released;}};
}

test('requires trusted server-side Postgres pool',()=>{
  assert.throws(()=>createRivetPostgresRepository({}),/postgres_pool_required/);
});
test('new intake writes contact, case, inquiry, task, activity atomically',async()=>{
  const f=mockPool();
  const receipt=await f.repo.saveInquiry(inquiry,key);
  assert.equal(receipt.replayed,false);
  assert.ok(receipt.id);
  assert.ok(receipt.caseId);
  assert.equal(f.log[0].sql,'BEGIN');
  assert.equal(f.log.at(-1).sql,'COMMIT');
  assert.deepEqual(f.log.filter(x=>x.sql.startsWith('INSERT INTO')).map(x=>x.sql.split(' ')[2]),[
    'rivet.contacts','rivet.cases','rivet.inquiries','rivet.tasks','rivet.activities'
  ]);
  assert.ok(!f.log.some(x=>x.sql.includes('rivet.properties'))); // missing address is allowed
  assert.equal(f.log.find(x=>x.sql.includes('INSERT INTO rivet.cases')).args.at(-1),'Needs repairs');
  assert.equal(f.released,true);
});
test('address creates property record and preserves unverified ownership',async()=>{
  const f=mockPool();
  await f.repo.saveInquiry({...inquiry,propertyAddress:'123 Test Street',city:'Austin'},key);
  const prop=f.log.find(x=>x.sql.startsWith('INSERT INTO rivet.properties'));
  assert.ok(prop);
  assert.equal(prop.args.at(-1),'unverified');
});
test('retries with identical body return existing receipt without duplicate writes',async()=>{
  const {repo,log,released}=mockPool({existing:{id:'old-1',case_id:'old-case',body_hash:' '}});
  // Existing hash is calculated from normalized input, not the request key.
  const {createHash}=await import('node:crypto');
  const digest=createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
  const f=mockPool({existing:{id:'old-1',case_id:'old-case',body_hash:digest+' '}});
  assert.deepEqual(await f.repo.saveInquiry(inquiry,key),{id:'old-1',caseId:'old-case',replayed:true});
  assert.equal(f.log.filter(x=>x.sql.startsWith('INSERT')).length,0);
  assert.equal(f.log.at(-1).sql,'COMMIT');
  assert.equal(f.released,true);
});
test('same idempotency key with changed body rolls back and refuses duplicate',async()=>{
  const f=mockPool({existing:{id:'old-1',case_id:'old-case',body_hash:'0'.repeat(64)}});
  await assert.rejects(f.repo.saveInquiry(inquiry,key),RivetIdempotencyConflict);
  assert.equal(f.log.at(-1).sql,'ROLLBACK');
  assert.equal(f.released,true);
});
test('database failure rolls back and releases connection',async()=>{
  const f=mockPool({failAt:'BEGIN'});
  await assert.rejects(f.repo.saveInquiry(inquiry,key),/database_unavailable/);
  assert.equal(f.released,true);
});
test('client IDs cannot self-grant staff membership',async()=>{
  const f=mockPool({member:{role:'operator',active:true},cases:[{id:'safe-case'}]});
  assert.equal(await f.repo.memberForUser('iwco',userId),null);
  assert.equal(await f.repo.memberForUser('rivet-auctions','invalid'),null);
  assert.deepEqual(await f.repo.memberForUser('rivet-auctions',userId),{role:'operator',active:true});
  assert.deepEqual(await f.repo.listForStaff(userId),[{id:'safe-case'}]);
  assert.ok(f.log.some(x=>x.sql.includes('m.active=true') && x.sql.includes('rivet.staff_memberships')));
});
test('SQL schema denies anon/authenticated and protects every sensitive table',()=>{
  const sql=readFileSync(new URL('../sql/initial-schema.sql',import.meta.url),'utf8');
  for (const name of ['staff_memberships','contacts','properties','cases','inquiries','tasks','activities']) {
    assert.match(sql,new RegExp('ALTER TABLE rivet\\.'+name+' ENABLE ROW LEVEL SECURITY;'));
  }
  assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA rivet FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|ALL) .* TO (?:anon|authenticated)/i);
  assert.match(sql,/FOREIGN KEY \(owner_workspace,owner_user_id\)/);
});
