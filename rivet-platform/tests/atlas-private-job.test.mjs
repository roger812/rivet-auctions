import test from 'node:test';
import assert from 'node:assert/strict';
import {runRivetAtlasDevelopmentJob} from '../src/atlas-private-job.mjs';
import {makeRivetAuctionLeadEnvelope} from '../src/atlas-lead-envelope.mjs';

const key='8f'.repeat(32);
const goodUrl='postgresql://postgres:fictional@db.kxcziyznpvbkgtgscdsd.supabase.co:5432/postgres';
const pem='-----BEGIN CERTIFICATE-----\ntest-only-fixture\n-----END CERTIFICATE-----';
const devEnv=()=>({
 RIVET_ATLAS_DELIVERY_ENABLED:'1',
 RIVET_ATLAS_MODE:'development_proof',
 RIVET_ATLAS_SHARED_KEY_HEX:key,
 RIVET_DEV_DATABASE_URL:goodUrl,
 RIVET_DEV_DB_CA_PEM:pem
});
const receipt={caseId:'7c702cb9-9ee1-4bde-bb80-05ad2987c813',
 id:'c76407fe-b730-4194-99f6-e87bcf65b543'};
const payload=makeRivetAuctionLeadEnvelope({
 receipt,inquiry:{kind:'seller',source:'google',consentToReply:true}
});
class FakePool{
 static events=[];
 constructor(options){
  this.options=options;
  FakePool.events.push(['new_pool']);
 }
 async connect(){
  FakePool.events.push(['connect']);
  return {
   async query(sql,args=[]){
    FakePool.events.push(['query',sql,args]);
    if(sql.startsWith('SELECT event_id,payload,attempts'))
     return {rows:[{event_id:'5b7163a8-0d66-4144-896d-17ffcd3a8ed74',payload,attempts:0}]};
    if(sql.startsWith('UPDATE rivet.lead_outbox SET delivery_status=$3'))
     return {rowCount:1,rows:[{event_id:'5b7163a8-0d66-4144-896d-17ffcd3a8ed74'}]};
    return {rowCount:1,rows:[]};
   },
   release(){FakePool.events.push(['release']);}
  };
 }
 async end(){FakePool.events.push(['end']);}
}
test('unset enable flag makes zero pool or network calls',async()=>{
 FakePool.events=[];
 const result=await runRivetAtlasDevelopmentJob({
  env:{},Pool:FakePool,fetcher:async()=>{throw Error('unexpected network')}
 });
 assert.deepEqual(result,{status:'disabled'});
 assert.deepEqual(FakePool.events,[]);
});
test('wrong mode and missing sender key fail before opening database',async()=>{
 FakePool.events=[];
 await assert.rejects(runRivetAtlasDevelopmentJob({
  env:{...devEnv(),RIVET_ATLAS_MODE:'production'},Pool:FakePool,fetcher:async()=>{}
 }),/rivet_development_mode_required/);
 await assert.rejects(runRivetAtlasDevelopmentJob({
  env:{...devEnv(),RIVET_ATLAS_SHARED_KEY_HEX:''},Pool:FakePool,fetcher:async()=>{}
 }),/rivet_atlas_delivery_not_configured/);
 assert.deepEqual(FakePool.events,[]);
});
test('wrong project and unverified CA never connect',async()=>{
 FakePool.events=[];
 await assert.rejects(runRivetAtlasDevelopmentJob({
  env:{...devEnv(),RIVET_DEV_DATABASE_URL:goodUrl.replace('kxcziyznpvbkgtgscdsd','wrong-project')},
  Pool:FakePool,fetcher:async()=>{}
 }),/wrong_rivet_database_project/);
 await assert.rejects(runRivetAtlasDevelopmentJob({
  env:{...devEnv(),RIVET_DEV_DB_CA_PEM:''},
  Pool:FakePool,fetcher:async()=>{}
 }),/rivet_ca_certificate_required/);
 assert.deepEqual(FakePool.events,[]);
});
test('enabled private dev job signs one event, settles it and closes pool',async()=>{
 FakePool.events=[];
 let delivered=0;
 const result=await runRivetAtlasDevelopmentJob({
  env:devEnv(),Pool:FakePool,clock:()=>Date.parse('2026-11-16T08:00:00.000Z'),
  fetcher:async(url,options)=>{
   delivered++;
   assert.equal(url,'https://iwco-private-preview-proof-morm.onrender.com/api/integrations/atlas/leads');
   assert.equal(options.headers['X-Atlas-Business'],'rivet-auctions');
   assert.equal(options.method,'POST');
   assert.equal(JSON.parse(options.body).businessId,'rivet-auctions');
   return {status:201,json:async()=>({indexed:true,replayed:false,leadRef:receipt.caseId})};
  }
 });
 assert.equal(result.status,'delivered');
 assert.equal(result.attempts,1);
 assert.equal(delivered,1);
 const commit=FakePool.events.findIndex(e=>e[0]==='query'&&e[1]==='COMMIT');
 const leave=FakePool.events.findIndex(e=>e[0]==='release');
 assert.ok(commit>=0&&leave>commit,'PG txn must finish before network I/O');
 assert.equal(FakePool.events.at(-1)[0],'end');
});
