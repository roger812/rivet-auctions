import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetApplication} from '../src/application.mjs';
const origin='https://rivetauctions.com';
const customer={id:'customer-should-never-leak',email:'private@example.invalid'};
const sample={kind:'seller',name:'Development Inquiry',email:'demo@example.invalid',preferredReply:'email',consentToReply:true};
function fixture(session=null, member=null) {
  const calls=[];
  const app=createRivetApplication({origin,
    sessions:{readVerified:async()=>session},
    members:{forUser:async (workspace,userId)=>{calls.push(['member',workspace,userId]);return member;}},
    cases:{listForStaff:async id=>{calls.push(['private-read',id]);return [customer];}},
    repository:{saveInquiry:async(data,key)=>{calls.push(['public-save',key,data.kind]);return {id:'receipt',caseId:'case',replayed:false};}},
    verifyHuman:async()=>true, rateLimiter:async()=>true
  });
  return {app,calls};
}
const req=(path,init)=>new Request(origin+path,init);
const submit=()=>req('/api/inquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':'rivet-test-0000000000000001'},body:JSON.stringify(sample)});
test('application requires complete security and storage adapters at creation',()=>{
  assert.throws(()=>createRivetApplication({origin}),/secure_staff_boundary_not_configured/);
});
test('public intake works without granting access to team CRM',async()=>{
  const {app,calls}=fixture();
  assert.equal((await app(submit())).status,201);
  assert.equal((await app(req('/team'))).status,401);
  const privateResponse=await app(req('/api/team/requests'));
  assert.equal(privateResponse.status,401);
  assert.doesNotMatch(await privateResponse.text(),/private@example/);
  assert.ok(calls.some(c=>c[0]==='public-save'));
  assert.ok(!calls.some(c=>c[0]==='private-read'));
});
test('staff membership grants private queue but never changes public intake permissions',async()=>{
  const {app,calls}=fixture({verified:true,principal:{userId:'staff-user'}},{active:true,role:'operator'});
  assert.equal((await app(req('/api/team/requests'))).status,200);
  assert.ok(calls.some(c=>c[0]==='private-read'));
  assert.equal((await app(req('/api/inquiries'))).status,403);
});
test('only health endpoint is public without any customer data',async()=>{
  const {app}=fixture();
  assert.equal(await (await app(req('/healthz'))).text(),'ok');
  assert.equal((await app(req('/unlisted'))).status,404);
});
