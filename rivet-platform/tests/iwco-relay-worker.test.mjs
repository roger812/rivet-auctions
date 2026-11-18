import test from 'node:test';
import assert from 'node:assert/strict';
import {main} from '../relay-worker/run.mjs';

const project='kxcziyznpvbkgtgscdsd';
const ENV={RIVET_ATLAS_RELAY_ENABLED:'1',RIVET_ATLAS_RELAY_ALLOW_REAL_DELIVERY:'1',
 IWCO_RIVET_EVENT_KEY_HEX:'a'.repeat(64),
 RIVET_ATLAS_RELAY_DB_URL:'postgresql://rivet_atlas_relay_login.'+project+
  ':secret@aws-1-us-east-1.pooler.supabase.com:5432/postgres'};
const id='22222222-2222-4222-8222-222222222222';
const receipt='33333333-3333-4333-8333-333333333333';
const eventId='44444444-4444-4444-8444-444444444444';
const meta=()=>({event_id:eventId,case_id:id,event_type:'lead.received',
 idempotency_key:'rivet-auctions:lead.received:'+id,
 payload:{schemaVersion:1,eventType:'lead.received',businessId:'rivet-auctions',
 sourceSystem:'rivet-auctions',leadRef:id,inquiryRef:receipt,
 leadType:'auction-seller-inquiry',idempotencyKey:'rivet-auctions:lead.received:'+id,
 initialStage:'New',assignedUserId:null,
 attribution:{channel:'website',reportedSource:'ra_direct',campaignId:null,verification:'unverified'},
 communication:{replyConsentRecordedBySource:true,marketingConsent:false},
 occurredAt:'2026-11-18T13:02:53.347Z',
 security:{containsCustomerPII:false,fullRecordAccess:'source_scoped_authorized_read',sourceMembershipRequired:true}}});
test('worker is inert without explicit activation, no DB attempt',async()=>{
 let count=0;class Pool{constructor(){count++;}}
 const lines=[];
 assert.equal((await main({env:{},Pool,log:x=>lines.push(x),errorLog:x=>lines.push(x)})).state,'disabled');
 assert.equal(count,0);
});
test('rejects superuser / unverified database hostname without connecting',async()=>{
 let count=0;class Pool{constructor(){count++;}}
 for(const url of [
  'postgresql://postgres:secret@db.'+project+'.supabase.co:5432/postgres',
  'postgresql://rivet_atlas_relay_login:secret@not-supabase.example:5432/postgres',
  ENV.RIVET_ATLAS_RELAY_DB_URL+'?sslmode=disable'
 ]){
  const res=await main({env:{...ENV,RIVET_ATLAS_RELAY_DB_URL:url},Pool,
   log:()=>{},errorLog:()=>{}});
  assert.equal(res.state,'disabled');
 }
 assert.equal(count,0);
});
test('worker verifies saved receiver receipt and acknowledges correct lease',async()=>{
 const sql=[];
 class Pool{
  constructor(config){assert.equal(config.max,1);assert.equal(config.ssl.rejectUnauthorized,true);
   assert.equal(config.application_name,'rivet_metadata_only_relay');}
  async connect(){return {query:async(s,args)=>{
   sql.push({s,args});
   if(s.includes('WITH next_event'))return {rows:[meta()]};
   if(s.includes("delivery_status='delivered'"))return {rows:[{event_id:eventId}]};
   throw Error('unexpected sql');
  },release(){}};}
  async end(){}
 }
 const out=await main({env:ENV,Pool,log:()=>{},errorLog:()=>{},
  fetcher:async(_,request)=>{
   assert.equal(request.method,'POST');
   assert.match(request.headers['X-Rivet-Signature'],/^sha256=[a-f0-9]{64}$/);
   assert.equal(request.credentials,'omit');
   assert.equal(request.body.includes('sensitive@example.com'),false);
   return {status:201,async json(){return {status:'received',businessId:'rivet-auctions',
    leadRef:id,inquiryRef:receipt,replayed:false};}};
  }});
 assert.equal(out.state,'delivered');
 assert.equal(sql.length,2);
 assert.match(sql[0].s,/SKIP LOCKED/);
 assert.match(sql[1].s,/lease_owner/);
});
