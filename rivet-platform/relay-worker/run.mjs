/** One-shot Rivet Auctions -> IWCO metadata relay worker.
 * Disabled by default. Use only in a private Render cron job with a dedicated,
 * restricted PostgreSQL login. Do not include this script in the public site.
 */
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createRivetOutboxRelay,createRivetPgOutboxStore,createIwcoMetadataTransport} from '../src/iwco-outbox-relay.mjs';

const RIVET='kxcziyznpvbkgtgscdsd';
const DIRECT='db.'+RIVET+'.supabase.co';
const POOLER='aws-1-us-east-1.pooler.supabase.com';
const name='rivet_atlas_relay_login';
const key=/^[a-f0-9]{64}$/;
const allowed=(env)=>{
 if(env.RIVET_ATLAS_RELAY_ENABLED!=='1')throw Error('relay_not_enabled');
 if(env.RIVET_ATLAS_RELAY_ALLOW_REAL_DELIVERY!=='1')throw Error('real_delivery_not_approved');
 if(!key.test(env.IWCO_RIVET_EVENT_KEY_HEX||''))throw Error('relay_key_missing');
 const raw=env.RIVET_ATLAS_RELAY_DB_URL;
 if(typeof raw!=='string')throw Error('restricted_database_url_required');
 let url;try{url=new URL(raw);}catch{throw Error('restricted_database_url_invalid');}
 const direct=url.hostname===DIRECT&&url.port==='5432'&&url.username===name;
 const pooler=url.hostname===POOLER&&url.port==='5432'&&url.username===name+'.'+RIVET;
 if(!['postgres:','postgresql:'].includes(url.protocol)||!(direct||pooler)||
    url.pathname!=='/postgres'||!url.password||url.search||url.hash)
    throw Error('restricted_database_identity_required');
 const ca=env.RIVET_ATLAS_RELAY_DB_CA_PEM;
 if(ca!==undefined&&(!ca.includes('-----BEGIN CERTIFICATE-----')||
    !ca.includes('-----END CERTIFICATE-----')))
    throw Error('trusted_database_ca_invalid');
 return {url:raw,hostname:url.hostname,ca,keyHex:env.IWCO_RIVET_EVENT_KEY_HEX};
};
export async function main({env=process.env,Pool=null,fetcher=fetch,log=line=>console.log(line),errorLog=line=>console.error(line)}={}){
 let config,pool;
 try{config=allowed(env);}
 catch(error){errorLog('RIVET_ATLAS_RELAY '+JSON.stringify({state:'disabled',code:error.message}));return {state:'disabled'};}
 try{
  if(!Pool){
   const require=createRequire(import.meta.url);
   const pkg=require('./package.json');
   if(pkg.dependencies.pg!=='8.16.3')throw Error('unreviewed_pg_version');
   Pool=(await import('pg')).default.Pool;
  }
  pool=new Pool({connectionString:config.url,
   ssl:{rejectUnauthorized:true,servername:config.hostname,
    ...(config.ca?{ca:config.ca}:{})},
   max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:1000,
   statement_timeout:8000,application_name:'rivet_metadata_only_relay'});
  const store=createRivetPgOutboxStore({pool,workerId:randomUUID()});
  const transport=createIwcoMetadataTransport({secretHex:config.keyHex,fetcher});
  const worker=createRivetOutboxRelay({enabled:true,store,transport});
  const result=await worker.tick();
  log('RIVET_ATLAS_RELAY '+JSON.stringify({state:result.state,
   code:result.state==='deferred'?result.code:undefined}));
  return result;
 }catch{
  errorLog('RIVET_ATLAS_RELAY '+JSON.stringify({state:'failed',code:'relay_not_completed'}));
  return {state:'failed'};
 }finally{if(pool)await pool.end().catch(()=>{});}
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const r=await main();
 if(r.state==='failed'||r.state==='deferred')process.exitCode=1;
}
