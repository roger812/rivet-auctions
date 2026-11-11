import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetPublicIntake, normalizeRivetInquiry} from '../src/public-intake.mjs';
const origin = 'https://rivetauctions.com';
const key = 'rivet-demo-request-000000000001';
const good = {
  kind:'seller', name:'Example Seller', email:'seller@example.com',
  preferredReply:'email', consentToReply:true, note:'Interested in options'
};
const makeRequest = (body=good, headers={}) => new Request(origin+'/api/inquiries', {
  method:'POST', headers:{'Origin':origin, 'Content-Type':'application/json',
    'Idempotency-Key':key, ...headers}, body:JSON.stringify(body)
});
const fixture = ({verified=true,allowed=true,storeError=false}={}) => {
  const saved=[];
  const handle=createRivetPublicIntake({origin,
    verifyHuman:async()=>verified,
    rateLimiter:async()=>allowed,
    repository:{saveInquiry:async (data, idempotencyKey)=>{
      if (storeError) throw Error('private_db_error');
      saved.push({data,idempotencyKey});
      return {id:'receipt-123',caseId:'case-123',replayed:false};
    }}
  });
  return {handle,saved};
};

test('missing storage/bot/rate providers fails closed',()=>{
  assert.throws(()=>createRivetPublicIntake({origin}),/public_intake_not_configured/);
});
test('minimal seller request stores only the normalized, consented inquiry',async()=>{
  const {handle,saved}=fixture();
  const r=await handle(makeRequest());
  assert.equal(r.status,201);
  assert.equal((await r.json()).reference,'receipt-123');
  assert.equal(saved.length,1);
  assert.equal(saved[0].data.claimedOwnership,'unverified');
  assert.equal(saved[0].data.bulkMarketing,false);
  assert.equal(saved[0].data.email,'seller@example.com');
  assert.equal(saved[0].data.source,'direct');
});
test('buyer request uses same private handoff without accepting bid amounts',()=>{
  assert.equal(normalizeRivetInquiry({...good,kind:'buyer'}).kind,'buyer');
  assert.throws(()=>normalizeRivetInquiry({...good,highestOffer:'900000'}),/unsupported_field/);
});
test('no contact, no consent, and honeypot are rejected',async()=>{
  const {handle,saved}=fixture();
  for (const body of [
    {...good,consentToReply:false},
    {...good,email:''},
    {...good,website:'spam.example'}
  ]) assert.equal((await handle(makeRequest(body))).status,422);
  assert.equal(saved.length,0);
});
test('spoofed origin, missing idempotency key and GET cannot write',async()=>{
  const {handle,saved}=fixture();
  assert.equal((await handle(makeRequest(good,{'Origin':'https://evil.example'}))).status,403);
  assert.equal((await handle(makeRequest(good,{'Idempotency-Key':''}))).status,400);
  assert.equal((await handle(new Request(origin+'/api/inquiries'))).status,403);
  assert.equal(saved.length,0);
});
test('rate limiter and real human verifier are required to pass',async()=>{
  for (const options of [{allowed:false},{verified:false}]) {
    const {handle,saved}=fixture(options);
    assert.ok([403,429].includes((await handle(makeRequest())).status));
    assert.equal(saved.length,0);
  }
});
test('storage failure does not reveal database details',async()=>{
  const {handle}=fixture({storeError:true});
  const r=await handle(makeRequest());
  assert.equal(r.status,503);
  assert.doesNotMatch(await r.text(),/private_db_error/);
});
test('input is bounded and must be valid JSON',async()=>{
  const {handle,saved}=fixture();
  const huge = {...good,note:'a'.repeat(8200)};
  assert.equal((await handle(makeRequest(huge))).status,413);
  const r=await handle(new Request(origin+'/api/inquiries',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':key},body:'{' 
  }));
  assert.equal(r.status,400);
  assert.equal(saved.length,0);
});
test('invalid email, missing reply method, non-Texas state are rejected',()=>{
  assert.throws(()=>normalizeRivetInquiry({...good,email:'wrong'}),/invalid_email/);
  assert.throws(()=>normalizeRivetInquiry({...good,preferredReply:'call'}),/phone_required/);
  assert.throws(()=>normalizeRivetInquiry({...good,state:'CA'}),/invalid_location/);
});
test('conflicting idempotency payload returns 409 without database internals',async()=>{
  const handle=createRivetPublicIntake({origin, verifyHuman:async()=>true, rateLimiter:async()=>true,
    repository:{saveInquiry:async()=>{const e=Error('private');e.code='request_changed_use_new_id';throw e;}}
  });
  const r=await handle(makeRequest());
  assert.equal(r.status,409);
  assert.deepEqual(await r.json(),{error:'request_changed_use_new_id'});
});
