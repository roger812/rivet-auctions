/**
 * Only Rivet's restricted source-detail DB identity may open this pool.
 * Never fallback to SUPABASE_DB_URL, postgres, service_role or browser keys.
 * No side effects: import never connects to a database.
 */
import {RIVET_DEVELOPMENT_PROJECT_REF} from './server-db.mjs';
const ROLE='rivet_atlas_detail_login';
export function createRivetAtlasDetailPool({Pool,connectionString,caCertificate}={}){
 if(typeof Pool!=='function')throw new TypeError('rivet_detail_pool_class_required');
 let uri;
 try{uri=new URL(connectionString);}catch{throw new TypeError('rivet_detail_database_url_required');}
 if(!['postgres:','postgresql:'].includes(uri.protocol)||!uri.password||
    uri.pathname!=='/postgres')throw new TypeError('rivet_detail_database_url_invalid');
 const direct=uri.hostname==='db.'+RIVET_DEVELOPMENT_PROJECT_REF+'.supabase.co' &&
   uri.username===ROLE;
 const pooler=uri.hostname.endsWith('.pooler.supabase.com') &&
   uri.username===ROLE+'.'+RIVET_DEVELOPMENT_PROJECT_REF;
 if(!direct&&!pooler)throw new TypeError('wrong_rivet_detail_database_identity');
 if(uri.port&&!['5432','6543'].includes(uri.port))
  throw new TypeError('wrong_rivet_detail_database_port');
 if(uri.search)throw new TypeError('rivet_detail_database_url_params_forbidden');
 if(typeof caCertificate!=='string'||
    !caCertificate.includes('-----BEGIN CERTIFICATE-----')||
    !caCertificate.includes('-----END CERTIFICATE-----'))
  throw new TypeError('rivet_detail_tls_ca_required');
 return new Pool({
  connectionString,ssl:{
   ca:caCertificate,rejectUnauthorized:true,servername:uri.hostname
  },
  max:2,connectionTimeoutMillis:6500,idleTimeoutMillis:1000,
  statement_timeout:7000,application_name:'rivet_atlas_source_detail'
 });
}
