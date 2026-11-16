import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetAtlasOutboxWorker,RivetOutboxError} from '../src/atlas-outbox-worker.mjs';
const eventId='c76407fe-b730-4194-99f6-e87bcf65b543';
const payload={businessId:'rivet-auctions',leadRef:'7c702cb9-9ee1-4bde-bb80-05ad2987c813'};

function fixture({hasItem=true,attempts=0,sendFails=false,lostLease=false}={}){
 const events=[];let state='pending',owner=null,currentAttempts=attempts;
 const client={
  async query(sql,args=[]){
   events.push({kind:'query',sql,args});
   if(sql.startsWith('SELECT event_id,payload,attempts'))
    return {rows:hasItem?[{event_id:eventId,payload,attempts:currentAttempts}]:[]};
   if(sql.includes("SET delivery_status='processing'")){
    state='processing';owner=args[1];currentAttempts++;return {rowCount:1,rows:[]};
   }
   if(sql.includes("SET delivery_status='paused'")){
    state='paused';return {rowCount:1,rows:[]};
   }
   if(sql.startsWith('UPDATE rivet.lead_outbox SET delivery_status=$3')){
    if(lostLease)return {rowCount:0,rows:[]};
    assert.equal(args[1],owner);
    state=args[2];return {rowCount:1,rows:[{event_id:eventId}]};
   }
   return {rows:[],rowCount:0};
  },
  release(){events.push({kind:'release'});}
 };
 let delivers=0;
 const sender={enabled:true,async deliver(item){
  delivers++;events.push({kind:'deliver',item});
  assert.equal(item.businessId,'rivet-auctions');
  if(sendFails){const e=new Error('fake failure');e.code='destination_unavailable';throw e;}
  return {delivered:true,replayed:false};
 }};
 const pool={async connect(){events.push({kind:'connect'});return client;}};
 const worker=createRivetAtlasOutboxWorker({pool,sender});
 return {worker,events,get state(){return state;},get delivers(){return delivers;}};
}
test('idle queue has no network calls or writes',async()=>{
 const f=fixture({hasItem:false});
 assert.deepEqual(await f.worker.runOnce(),{status:'idle'});
 assert.equal(f.delivers,0);
 assert.ok(f.events.some(e=>e.sql==='COMMIT'));
});
test('claimed event sent outside transaction then marked delivered',async()=>{
 const f=fixture();
 assert.deepEqual(await f.worker.runOnce(),{status:'delivered',attempts:1,replayed:false});
 assert.equal(f.state,'delivered');
 assert.equal(f.delivers,1);
 const commit=f.events.findIndex(e=>e.sql==='COMMIT'),send=f.events.findIndex(e=>e.kind==='deliver');
 assert.ok(commit>=0&&send>commit,'never send while holding DB transaction');
 assert.ok(f.events.some(e=>e.sql?.includes('SKIP LOCKED')));
});
test('recipient outage schedules retry with bounded backoff',async()=>{
 const f=fixture({sendFails:true});
 assert.deepEqual(await f.worker.runOnce(),{
  status:'retry',attempts:1,errorCode:'destination_unavailable'
 });
 assert.equal(f.state,'retry');
 const settle=f.events.find(e=>e.sql?.startsWith('UPDATE rivet.lead_outbox SET delivery_status=$3'));
 assert.equal(settle.args[3],30);
});
test('retry budget pauses the event rather than dropping it',async()=>{
 const f=fixture({attempts:8});
 assert.deepEqual(await f.worker.runOnce(),{status:'paused'});
 assert.equal(f.delivers,0);
});
test('loss of lease never falsely reports delivery',async()=>{
 const f=fixture({lostLease:true});
 await assert.rejects(f.worker.runOnce(),RivetOutboxError);
});
test('unconfigured sender cannot activate worker',()=>{
 assert.throws(()=>createRivetAtlasOutboxWorker({
  pool:{connect:async()=>({})},sender:{enabled:false,deliver(){}}
 }),/rivet_outbox_worker_not_configured/);
});
