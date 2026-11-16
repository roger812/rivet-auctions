/**
 * Only Rivet's restricted source-detail DB identity may open this pool.
 * Never fallback to SUPABASE_DB_URL, postgres, service_role or browser keys.
 * No side effects: import never connects to a database.
 */
import {RIVET_DEVELOPMENT_PROJECT_REF} from './server-db.mjs';
const ROLE='rivet_atlas_detail_login';
const VERIFIED_POOLER_HOST='aws-1-us-east-1.pooler.supabase.com';
export function createRivetAtlasDetailPool({Pool,connectionString,caCertificate}={}){
 if(typeof Pool!=='function')throw new TypeError('rivet_detail_pool_class_required');
 let uri;
 try{uri=new URL(connectionString);}catch{throw new TypeError('rivet_detail_database_url_required');}
 if(!['postgres:','postgresql:'].includes(uri.protocol)||!uri.password||
    uri.pathname!=='/postgres')throw new TypeError('rivet_detail_database_url_invalid');
 const direct=uri.hostname==='db.'+RIVET_DEVELOPMENT_PROJECT_REF+'.supabase.co' &&
   uri.port==='5432' && uri.username===ROLE;
 const pooler=uri.hostname===VERIFIED_POOLER_HOST && uri.port==='5432' &&
   uri.username===ROLE+'.'+RIVET_DEVELOPMENT_PROJECT_REF;
 if(!direct&&!pooler)throw new TypeError('wrong_rivet_detail_database_identity');
 if(uri.search)throw new TypeError('rivet_detail_database_url_params_forbidden');
 const usingCustomCA=typeof caCertificate==='string'&&caCertificate.length>0;
 if(usingCustomCA&&(!caCertificate.includes('-----BEGIN CERTIFICATE-----')||
    !caCertificate.includes('-----END CERTIFICATE-----')))
  throw new TypeError('rivet_detail_tls_ca_invalid');
 if(caCertificate!=null&&typeof caCertificate!=='string')
  throw new TypeError('rivet_detail_tls_ca_invalid');
 // Without a project-supplied CA, Node's trusted root CA store is used.
 // TLS certificate and hostname verification remain REQUIRED in both cases.
 return new Pool({
  connectionString,ssl:{
   rejectUnauthorized:true,servername:uri.hostname,
   ...(usingCustomCA?{ca:caCertificate}:{})
  },
  max:2,connectionTimeoutMillis:6500,idleTimeoutMillis:1000,
  statement_timeout:7000,application_name:'rivet_atlas_source_detail'
 });
}
