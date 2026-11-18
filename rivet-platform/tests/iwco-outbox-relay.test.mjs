import test from 'node:test';
import assert from 'node:assert/strict';
import {createIwcoMetadataTransport,createRivetOutboxRelay,
 validateRivetOutboxEvent,createRivetPgOutboxStore} from '../src/iwco-outbox-relay.mjs';

const EVENT='44444444-4444-4444-8444-444444444444';
const CASE='22222222-2222-4222-8222-222222222222';
const REC='33333333-3333-4333-8333-333333333333';
const WORKER='55555555-5555-4555-8555-555555555555';
const row=()=>({event_id:EVENT,case_id:CASE,event_type:'lead.received',
 idempotency_key:'rivet-auctions:lead.received:'+CASE,payload:{
  schemaVersion:1,eventType:'lead.received',idempotencyKey:'rivet-auctions:lead.received:'+CASE,
  businessId:'rivet-auctions',sourceSystem:'rivet-auctions',leadRef:CASE,inquiryRef:REC,
  leadType:'auction-seller-inquiry',initialStage:'New',assignedUserId:null,
  attribution:{channel:'website',reportedSource:'ra_direct',campaignId:null,verification:'unverified'},
  communication:{replyConsentRecordedBySource:true,marketingConsent:false},
  occurredAt:'2026-11-18T13:02:53.236Z',
  security:{containsCustomerPII:false,fullRecordAccess:'source_scoped_authorized_read',sourceMembershipRequired:true}
 }});
test('only metadata, not homeowner details, can leave the Rivet outbox',()=>{
 assert.equal(validateRivetOutboxEvent(row()).eventId,EVENT);
 const x=row();x.payload.email='sensitive@example.com';
 assert.throws(()=>validateRivetOutboxEvent(x),/rivet_outbox_event_invalid/);
 const y=row();y.payload.attribution.address='123 Example St';
 assert.throws(()=>validateRivetOutboxEvent(y),/rivet_outbox_event_invalid/);
});
test('transport sends signed JSON without credentials and requires matched committed receipt',async()=>{
 let seen;
 const transport=createIwcoMetadataTransport({secretHex:'a'.repeat(64),
  clock:()=>Date.parse('2026-11-18T14:00:00Z'),
  fetcher:async(url,opts)=>{
   seen={url,opts};
   return {status:201,async json(){return {status:'received',businessId:'rivet-auctions',
    leadRef:CASE,inquiryRef:REC,replayed:false};}};
  }});
 const result=await transport.send(validateRivetOutboxEvent(row()));
 assert.equal(result.replayed,false);
 assert.match(seen.url,/\/api\/integrations\/rivet-auctions\/lead$/);
 assert.ok(/^sha256=[a-f0-9]{64}$/.test(seen.opts.headers['X-Rivet-Signature']));
 assert.equal(seen.opts.headers['X-Rivet-Business'],'rivet-auctions');
 assert.equal(seen.opts.credentials,'omit');
 assert.equal(seen.opts.body.includes('sensitive@example.com'),false);
});
test('bad or unmatched receiver results cannot acknowledge delivery',async()=>{
 const transport=createIwcoMetadataTransport({secretHex:'a'.repeat(64),
  fetcher:async()=>({status:200,async json(){return {status:'received',
   businessId:'rivet-auctions',leadRef:CASE,inquiryRef:EVENT,replayed:false};}})});
 await assert.rejects(transport.send(validateRivetOutboxEvent(row())),/rivet_relay_receipt_not_verified/);
});
test('relay acknowledges only a verified receiver result',async()=>{
 let ack=0,defer=0;
 const bridge=createRivetOutboxRelay({enabled:true,
  store:{claim:async()=>row(),ack:async id=>{assert.equal(id,EVENT);ack++;return true;},
   defer:async()=>{defer++;}},
  transport:{send:async()=>({replayed:false})}});
 assert.equal((await bridge.tick()).state,'delivered');
 assert.equal(ack,1);assert.equal(defer,0);
});
test('uncertain destination failure is deferred, never reported delivered',async()=>{
 let ack=0,defer=0;
 const bridge=createRivetOutboxRelay({enabled:true,
  store:{claim:async()=>row(),ack:async()=>{ack++;return true;},
   defer:async(id,code)=>{assert.equal(id,EVENT);assert.equal(code,'rivet_relay_unexpected_failure');defer++;}},
  transport:{send:async()=>{throw Error('socket reset');}}});
 assert.equal((await bridge.tick()).state,'deferred');
 assert.equal(ack,0);assert.equal(defer,1);
});
test('postgres store leases by worker, skips smoke records, and never reads customer PII',async()=>{
 const queries=[];
 const pool={async connect(){return {async query(sql,args){queries.push({sql,args});return {rows:[]};},
   release(){}};}};
 const store=createRivetPgOutboxStore({pool,workerId:WORKER});
 assert.equal(await store.claim(),null);
 assert.match(queries[0].sql,/SKIP LOCKED/);
 assert.match(queries[0].sql,/ra_internal_smoke/);
 assert.match(queries[0].sql,/lease_expires_at/);
 assert.doesNotMatch(queries[0].sql,/display_name|submitted_address|phone|email/);
 assert.equal(await store.ack(EVENT),false);
 assert.equal(await store.defer(EVENT,'receipt_unconfirmed'),false);
 assert.match(queries[1].sql,/lease_owner=\$2/);
 assert.match(queries[2].sql,/delivery_status=CASE WHEN attempts>=8/);
});
test('disabled bridge has no database work or outgoing requests',async()=>{
 const bridge=createRivetOutboxRelay();
 assert.deepEqual(await bridge.tick(),{state:'disabled'});
});
