import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetAtlasDetailPool} from '../src/atlas-detail-db.mjs';

const project='kxcziyznpvbkgtgscdsd';
const cert='-----BEGIN CERTIFICATE-----\nfictional-test-CA\n-----END CERTIFICATE-----';
const direct='postgresql://rivet_atlas_detail_login:example-fixture@db.'+project+'.supabase.co:5432/postgres';
const pooled='postgresql://rivet_atlas_detail_login.'+project+':example-fixture@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const calls=[];
class FakePool{constructor(config){calls.push(config);this.options=config;}}
test('direct restricted Rivet role requires verified CA and a bounded pool',()=>{
 calls.length=0;
 const pool=createRivetAtlasDetailPool({Pool:FakePool,connectionString:direct,caCertificate:cert});
 assert.equal(calls.length,1);
 assert.equal(pool.options.max,2);
 assert.equal(pool.options.ssl.rejectUnauthorized,true);
 assert.equal(pool.options.ssl.servername,'db.'+project+'.supabase.co');
 assert.equal(pool.options.statement_timeout,7000);
});
test('source role pooler connection remains bound to Rivet development project',()=>{
 calls.length=0;
 const pool=createRivetAtlasDetailPool({Pool:FakePool,connectionString:pooled,caCertificate:cert});
 assert.equal(pool.options.ssl.servername,'aws-0-us-east-1.pooler.supabase.com');
 assert.equal(calls.length,1);
});
test('admin, other-company identity, wrong region/port, bad credentials and malformed CA fail before pool',()=>{
 calls.length=0;
 for(const url of [
  direct.replace('rivet_atlas_detail_login','postgres'),
  direct.replace(project,'llizgsrbqhonvruxaoho'),
  pooled.replace(project,'llizgsrbqhonvruxaoho'),
  pooled.replace('rivet_atlas_detail_login','postgres'),
  pooled.replace('aws-1-us-east-1.pooler.supabase.com','aws-0-us-east-1.pooler.supabase.com'),
  pooled.replace(':5432/',':6543/'),
  direct.replace('example-fixture',''),
  direct.replace(':5432/',':1234/'),
  direct+'?sslmode=disable',
  direct.replace('db.'+project+'.supabase.co','attacker.invalid'),
  'not a database url'
 ]){
  assert.throws(()=>createRivetAtlasDetailPool({
   Pool:FakePool,connectionString:url,caCertificate:cert
  }),TypeError,url);
 }
 assert.throws(()=>createRivetAtlasDetailPool({
  Pool:FakePool,connectionString:direct,caCertificate:'invalid-pem'
 }),/rivet_detail_tls_ca_invalid/);
 assert.equal(calls.length,0);
});

test('default system CA requires certificate and host verification when no custom CA is supplied',()=>{
 calls.length=0;
 const pool=createRivetAtlasDetailPool({Pool:FakePool,connectionString:pooled});
 assert.equal(pool.options.ssl.rejectUnauthorized,true);
 assert.equal(pool.options.ssl.servername,'aws-1-us-east-1.pooler.supabase.com');
 assert.equal(Object.hasOwn(pool.options.ssl,'ca'),false);
 assert.equal(calls.length,1);
});
