import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createRivetAtlasDetailReader,RivetDetailError} from '../src/atlas-lead-detail.mjs';

const secret='a7'.repeat(32);
const now=Date.parse('2026-11-16T09:00:00.000Z');
const workspace='c7bb14e9-855d-4e91-aead-0e421e50f4a1';
const actor='6ed6423c-5cc8-4108-948c-42a80eb5991a';
const lead='7c702cb9-9ee1-4bde-bb80-05ad2987c813';
const inquiry='c76407fe-b730-4194-99f6-e87bcf65b543';
const detail={schemaVersion:1,businessId:'rivet-auctions',
 leadRef:lead,inquiryRef:inquiry,workspaceId:workspace,
 actorUserId:actor,purpose:'staff_case_review'};
function signed(body=detail,{timestamp=String(Math.floor(now/1000)),headers={}}={}){
 const raw=JSON.stringify(body),signature=createHmac('sha256',Buffer.from(secret,'hex'))
   .update(timestamp).update('\n').update(raw).digest('hex');
 return new Request('https://rivet.example.invalid/api/integrations/atlas/detail',{
  method:'POST',
  headers:{'X-Atlas-Business':'rivet-auctions',
   'X-Atlas-Timestamp':timestamp,'X-Atlas-Signature':'sha256='+signature,
   'Content-Type':'application/json',...headers},body:raw
 });
}
function setup({missing=false}={}){
 const calls=[];
 const pool={async query(sql,params){
  calls.push({sql,params});
  return {rowCount:missing?0:1,rows:missing?[]:[{
   case_id:lead,inquiry_id:inquiry,kind:'seller',stage:'New',
   display_name:'Fictional Seller',email:'fictional@example.invalid',
   phone:'+15555550111',preferred_reply:'email',
   submitted_address:'123 Fictional Lane',city:'Austin',state:'TX',
   postal_code:'78717',reply_consent:true,consent_version:'v1',
   intake_note:'private note must never appear'
  }]};
 }};
 return {calls,reader:createRivetAtlasDetailReader({
  enabled:true,pool,secretHex:secret,expectedWorkspaceId:workspace,clock:()=>now
 })};
}
test('disabled reader is inert and opens no DB connection',async()=>{
 const reader=createRivetAtlasDetailReader();
 assert.equal(reader.enabled,false);
 await assert.rejects(reader.receive(signed()),RivetDetailError);
});
test('signed exact lead + inquiry returns only approved source contact fields',async()=>{
 const {reader,calls}=setup();
 const result=await reader.receive(signed());
 assert.equal(result.businessId,'rivet-auctions');
 assert.equal(result.displayName,'Fictional Seller');
 assert.equal(result.propertyAddress,'123 Fictional Lane');
 assert.equal(result.replyConsentRecordedBySource,true);
 assert.equal(result.marketingConsent,false);
 assert.ok(!JSON.stringify(result).includes('private note'));
 assert.deepEqual(calls[0].params,[lead,inquiry]);
 assert.match(calls[0].sql,/JOIN rivet\.inquiries i ON i\.case_id=c\.id/);
 assert.match(calls[0].sql,/WHERE c\.id=\$1 AND i\.id=\$2/);
 assert.equal(calls.length,1);
});
test('unsigned, spoofed, browser and wrong-workspace requests touch no database',async()=>{
 const {reader,calls}=setup();
 const bad=[
  signed(detail,{headers:{Origin:'https://rivetauctions.com'}}),
  signed(detail,{headers:{'Sec-Fetch-Site':'cross-site'}}),
  signed(detail,{headers:{'X-Atlas-Business':'iwco'}}),
  signed(detail,{headers:{'X-Atlas-Signature':'sha256='+'0'.repeat(64)}}),
  signed({...detail,workspaceId:'f3fd3f24-374a-4c94-a5f5-806e7c0440e9'}),
  signed({...detail,purpose:'list_all'}),
  signed({...detail,email:'unauthorized@example.com'}),
  signed(detail,{timestamp:String(Math.floor(now/1000)-1000)})
 ];
 for(const req of bad)await assert.rejects(reader.receive(req),RivetDetailError);
 assert.equal(calls.length,0);
 // A *validly signed* different lead ID is allowed to reach a precisely
 // parameterized lookup, but must NOT return an unrelated contact.
 await assert.rejects(reader.receive(signed({
  ...detail,leadRef:'00000000-0000-4000-8000-000000000000'
 })),/rivet_detail_not_found/);
 assert.equal(calls.length,1);
});
test('correctly signed unknown lead does not return unrelated case or contact',async()=>{
 const {reader,calls}=setup({missing:true});
 await assert.rejects(reader.receive(signed()),/rivet_detail_not_found/);
 assert.deepEqual(calls[0].params,[lead,inquiry]);
});
test('wrong source/role configuration cannot enable reader',()=>{
 assert.throws(()=>createRivetAtlasDetailReader({enabled:true,
  pool:{query(){}},secretHex:'',expectedWorkspaceId:workspace}),RivetDetailError);
 assert.throws(()=>createRivetAtlasDetailReader({enabled:true,
  pool:{query(){}},secretHex:secret,expectedWorkspaceId:'wrong'}),RivetDetailError);
});
