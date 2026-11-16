import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createRivetAtlasSender,RivetDeliveryError} from '../src/atlas-signed-delivery.mjs';
import {makeRivetAuctionLeadEnvelope} from '../src/atlas-lead-envelope.mjs';

const key='7c'.repeat(32);
const now=Date.parse('2026-11-16T07:00:00.000Z');
const inquiry={kind:'seller',name:'Never Transfer This Name',
 email:'never-transfer@example.invalid',note:'Never transfer personal notes',
 source:'google',consentToReply:true};
const receipt={
 caseId:'7c702cb9-9ee1-4bde-bb80-05ad2987c813',
 id:'c76407fe-b730-4194-99f6-e87bcf65b543'
};
const envelope=makeRivetAuctionLeadEnvelope({inquiry,receipt});
test('sender is inert unless explicitly enabled',async()=>{
 let called=false;
 const sender=createRivetAtlasSender({fetcher:async()=>{called=true;}});
 assert.equal(sender.enabled,false);
 await assert.rejects(sender.deliver(envelope),RivetDeliveryError);
 assert.equal(called,false);
});
test('signs Rivet metadata exactly as receiver expects and omits PII',async()=>{
 let request=null;
 const sender=createRivetAtlasSender({
  enabled:true,secretHex:key,clock:()=>now,
  fetcher:async (url,options)=>{
   request={url,options};
   return {status:201,json:async()=>({indexed:true,replayed:false,leadRef:receipt.caseId})};
  }
 });
 assert.deepEqual(await sender.deliver(envelope),{
  delivered:true,replayed:false,leadRef:receipt.caseId
 });
 assert.equal(request.url,'https://iwco-private-preview-proof-morm.onrender.com/api/integrations/atlas/leads');
 assert.equal(request.options.headers['X-Atlas-Business'],'rivet-auctions');
 const time=request.options.headers['X-Atlas-Timestamp'];
 assert.equal(time,String(Math.floor(now/1000)));
 const expected=createHmac('sha256',Buffer.from(key,'hex'))
  .update(time).update('\n').update(request.options.body).digest('hex');
 assert.equal(request.options.headers['X-Atlas-Signature'],'sha256='+expected);
 assert.ok(!request.options.body.includes(inquiry.name));
 assert.ok(!request.options.body.includes(inquiry.email));
 assert.ok(!request.options.body.includes(inquiry.note));
 assert.equal(JSON.parse(request.options.body).attribution.reportedSource,'google');
});
test('valid signed duplicate acknowledgment is safe',async()=>{
 const sender=createRivetAtlasSender({enabled:true,secretHex:key,clock:()=>now,
  fetcher:async()=>({status:200,json:async()=>({indexed:true,replayed:true,leadRef:receipt.caseId})})});
 assert.equal((await sender.deliver(envelope)).replayed,true);
});
test('refuses injection of contact information into lead metadata',async()=>{
 let called=false;
 const sender=createRivetAtlasSender({enabled:true,secretHex:key,clock:()=>now,
  fetcher:async()=>{called=true;return {status:201,json:async()=>({indexed:true,replayed:false,leadRef:receipt.caseId})};}});
 for(const event of [
  {...envelope,email:'sensitive@example.com'},
  {...envelope,security:{...envelope.security,containsCustomerPII:true}},
  {...envelope,communication:{...envelope.communication,marketingConsent:true}}
 ])await assert.rejects(sender.deliver(event),RivetDeliveryError);
 assert.equal(called,false);
});
test('recipient outage fails cleanly and cannot claim delivery',async()=>{
 const sender=createRivetAtlasSender({enabled:true,secretHex:key,clock:()=>now,
  fetcher:async()=>({status:503,json:async()=>({})})});
 await assert.rejects(sender.deliver(envelope),/rivet_atlas_destination_unavailable/);
});
test('never permits arbitrary destinations or missing credentials',()=>{
 assert.throws(()=>createRivetAtlasSender({enabled:true,secretHex:key,
  fetcher:async()=>({}),endpoint:'https://attacker.example.com'}),RivetDeliveryError);
 assert.throws(()=>createRivetAtlasSender({enabled:true,secretHex:'',fetcher:async()=>({})}),RivetDeliveryError);
});
