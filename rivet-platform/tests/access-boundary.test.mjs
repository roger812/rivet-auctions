import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetStaffBoundary} from '../src/access-boundary.mjs';

const origin = 'https://rivetauctions.com';
const customer = {id:'rivet-inquiry-test',name:'Fictional Seller'};
const request = (path, options={}) => new Request(origin + path, options);

function fixture({session=null, member=null, error=false} = {}) {
  const log = [];
  const fetchRivet = createRivetStaffBoundary({
    origin,
    sessions:{readVerified:async()=>{if(error)throw Error('provider down');return session;}},
    members:{forUser:async (workspace,id)=>{log.push(['membership',workspace,id]);return member;}},
    cases:{listForStaff:async (actor)=>{log.push(['query',actor]);return [customer];}}
  });
  return {fetchRivet,log};
}

test('fails closed if session verification or membership lookup is not configured',()=>{
  assert.throws(()=>createRivetStaffBoundary({origin}),/secure_staff_boundary_not_configured/);
  assert.throws(()=>createRivetStaffBoundary({origin,sessions:{readVerified:async()=>({})}}),/secure_staff_boundary_not_configured/);
});
test('anonymous visitor cannot open /team',async()=>{
  const {fetchRivet,log}=fixture();
  const r=await fetchRivet(request('/team'));
  assert.equal(r.status,401);
  assert.deepEqual(log,[]);
});
test('anonymous visitor cannot read CRM endpoint',async()=>{
  const {fetchRivet,log}=fixture();
  const r=await fetchRivet(request('/api/team/requests'));
  assert.equal(r.status,401);
  assert.deepEqual(log,[]);
  assert.doesNotMatch(await r.text(),/Fictional Seller/);
});
test('unverified identity or fake browser user header cannot access',async()=>{
  const {fetchRivet,log}=fixture({session:{verified:false,principal:{userId:'forged'}}});
  const r=await fetchRivet(request('/api/team/requests',{headers:{'X-User-ID':'forged'}}));
  assert.equal(r.status,401);
  assert.deepEqual(log,[]);
});
test('valid signed-in identity without Rivet membership is denied',async()=>{
  const {fetchRivet,log}=fixture({session:{verified:true,principal:{userId:'u-1'}}});
  assert.equal((await fetchRivet(request('/api/team/requests'))).status,403);
  assert.deepEqual(log,[['membership','rivet-auctions','u-1']]);
});
test('inactive membership and support role cannot read customer data',async()=>{
  for (const member of [{active:false,role:'operator'},{active:true,role:'support'}]) {
    const {fetchRivet,log}=fixture({session:{verified:true,principal:{userId:'u-2'}},member});
    const r=await fetchRivet(request('/api/team/requests'));
    assert.equal(r.status,403);
    assert.ok(!log.some(x=>x[0]==='query'));
  }
});
test('Rivet operator can open /team and read scoped queue',async()=>{
  const {fetchRivet,log}=fixture({
    session:{verified:true,principal:{userId:'u-3'}},
    member:{active:true,role:'operator'}
  });
  assert.equal((await fetchRivet(request('/team'))).status,200);
  const r=await fetchRivet(request('/api/team/requests'));
  assert.equal(r.status,200);
  assert.deepEqual((await r.json()).requests,[customer]);
  assert.ok(log.some(x=>x[0]==='query'&&x[1]==='u-3'));
});
test('no public route or write action is implicitly enabled',async()=>{
  const {fetchRivet}=fixture({session:{verified:true,principal:{userId:'u-3'}},member:{active:true,role:'administrator'}});
  assert.equal((await fetchRivet(request('/api/team/requests',{method:'POST'}))).status,405);
  assert.equal((await fetchRivet(request('/api/inquiries'))).status,404);
  assert.equal((await fetchRivet(request('/team/debug'))).status,404);
});
test('session provider failure never returns customer data',async()=>{
  const {fetchRivet,log}=fixture({error:true});
  const r=await fetchRivet(request('/api/team/requests'));
  assert.equal(r.status,503);
  assert.doesNotMatch(await r.text(),/Fictional Seller/);
  assert.deepEqual(log,[]);
});
