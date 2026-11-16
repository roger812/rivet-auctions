/**
 * Rivet DEVELOPMENT-only Supabase Edge read endpoint for an authorized
 * IWCO staff member. This function is deliberately INERT unless all separate
 * secrets and the enabled flag are installed in protected Edge configuration.
 *
 * Must deploy with verify_jwt=false because the only supported caller uses
 * the source-detail HMAC protocol, NOT a Supabase user JWT. No CORS.
 * No SUPABASE_DB_URL, service_role or project-admin DB credentials accepted.
 */
import pg from 'npm:pg@8.16.3';
import {createRivetAtlasDetailPool} from './atlas-detail-db.mjs';
import {createRivetAtlasDetailReader} from './atlas-lead-detail.mjs';

const {Pool}=pg;
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'private, no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Robots-Tag':'noindex, nofollow'
};
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers});
const enabled=Deno.env.get('RIVET_ATLAS_SOURCE_DETAIL_ENABLED')==='1';
let reader=null,pool=null;
if(enabled){
 try{
  pool=createRivetAtlasDetailPool({
   Pool,connectionString:Deno.env.get('RIVET_ATLAS_DETAIL_DB_URL'),
   caCertificate:Deno.env.get('RIVET_ATLAS_DETAIL_DB_CA_PEM')
  });
  reader=createRivetAtlasDetailReader({
   enabled:true,pool,secretHex:Deno.env.get('RIVET_ATLAS_DETAIL_KEY_HEX'),
   expectedWorkspaceId:Deno.env.get('RIVET_ATLAS_IWCO_WORKSPACE_ID')
  });
 }catch{
  // No fallback. Never create a broader connection automatically.
  reader=null;
  if(pool)await pool.end().catch(()=>{});
  pool=null;
 }
}
Deno.serve(async request=>{
 if(request.method!=='POST')return response(405,{error:'method_not_allowed'});
 if(!reader)return response(503,{error:'source_detail_not_activated'});
 if(request.headers.get('Origin')||request.headers.get('Sec-Fetch-Site'))
  return response(403,{error:'source_detail_forbidden'});
 const length=Number(request.headers.get('Content-Length')||0);
 if(length>1024)return response(413,{error:'source_detail_request_too_large'});
 try{
  const result=await reader.receive(request);
  return response(200,result);
 }catch{
  // No personal data or identifiers in errors or application logs.
  return response(403,{error:'source_detail_forbidden'});
 }
});
