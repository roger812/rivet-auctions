/**
 * Rivet public intake Edge gateway — FAIL-CLOSED until real security and
 * human-response readiness gates are satisfied.
 *
 * Requires RIVET_PUBLIC_INTAKE_ENABLED=1, RIVET_APPROVED_ORIGIN,
 * RIVET_TURNSTILE_SECRET, SUPABASE_DB_URL and rivet.intake_rate_windows.
 * This never grants anon or authenticated access to private Rivet tables.
 * No IWCO data transfer or customer-facing offer/bid registration.
 */
import pg from 'npm:pg@8.16.3';
import {createRivetPublicIntake} from './public-intake.mjs';
import {createRivetPostgresRepository} from './postgres-repository.mjs';
const {Pool}=pg;

const allowedOrigins=new Set([
 'https://rivetauctions.com',
 'https://www.rivetauctions.com',
 'https://rivet-auctions-public-candidate-20261117.onrender.com'
]);
const enabled=Deno.env.get('RIVET_PUBLIC_INTAKE_ENABLED')==='1';
const origin=Deno.env.get('RIVET_APPROVED_ORIGIN')||'';
const secret=Deno.env.get('RIVET_TURNSTILE_SECRET')||'';
const db=Deno.env.get('SUPABASE_DB_URL')||'';
const configReady=enabled&&allowedOrigins.has(origin)&&secret.length>=24&&db.startsWith('postgres');
const pool=configReady?new Pool({connectionString:db,max:2,connectionTimeoutMillis:6500,idleTimeoutMillis:1000}):null;

const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(code,body,allowed='')=>new Response(JSON.stringify(body),{
 status:code,headers:{...h,...(allowed?{'Access-Control-Allow-Origin':allowed,'Vary':'Origin'}:{})}
});

function originForRequest(req){
 const v=req.headers.get('Origin')||'';
 return configReady&&v===origin?v:'';
}

async function verifyHuman(_request,token){
 if(typeof token!=='string'||token.length<10||token.length>2048)return false;
 try{
  const controller=new AbortController();
  const t=setTimeout(()=>controller.abort(),4500);
  try{
   const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',signal:controller.signal,
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({secret,response:token})
   });
   if(!result.ok)return false;
   const value=await result.json();
   // Prevent a valid token issued to another site from being accepted.
   return value.success===true&&value.hostname===new URL(origin).hostname;
  }finally{clearTimeout(t);}
 }catch{return false;}
}

// A global circuit breaker is supplemental to the real single-use Turnstile
// token. The private SQL window is atomic across Edge instances.
async function rateLimiter(_request){
 if(!pool)return false;
 try{
  const q=await pool.query(
   'INSERT INTO rivet.intake_rate_windows (scope,window_start,attempts) '+
   "VALUES ('global',date_trunc('minute',now()),1) "+
   'ON CONFLICT (scope,window_start) DO UPDATE SET attempts=rivet.intake_rate_windows.attempts+1 '+
   'WHERE rivet.intake_rate_windows.attempts < 120 RETURNING attempts'
  );
  return q.rowCount===1;
 }catch{return false;}
}

// No startup fallback to fake repositories or bypassed auth. Activation
// requires operational review, a verified owned DB and real Turnstile keys.
const intake=configReady?createRivetPublicIntake({
 origin,repository:createRivetPostgresRepository({pool}),verifyHuman,rateLimiter
}):null;

Deno.serve(async req=>{
 const requestOrigin=req.headers.get('Origin')||'';
 const cors=originForRequest(req);
 if(req.method==='OPTIONS'){
  if(!cors)return reply(403,{error:'origin_not_allowed'});
  return new Response(null,{status:204,headers:{
   'Access-Control-Allow-Origin':cors,'Vary':'Origin',
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type, Idempotency-Key',
   'Access-Control-Max-Age':'300'
  }});
 }
 if(!intake)return reply(503,{error:'intake_not_activated'});
 if(!cors)return reply(403,{error:'origin_not_allowed'});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'},cors);
 const url=new URL(req.url);
 if(url.pathname!=='/rivet-public-intake'&&!url.pathname.endsWith('/rivet-public-intake'))
  return reply(404,{error:'not_found'},cors);
 // Normalize to the exact, shared application contract and require its
 // actual commit receipt from the database transaction.
 const reqHeaders=new Headers(req.headers);
 reqHeaders.set('Origin',origin);
 const proxy=new Request(origin+'/api/inquiries',{
  method:'POST',headers:reqHeaders,body:req.body,duplex:'half'
 });
 try{
  const result=await intake(proxy);
  const data=await result.text();
  return new Response(data,{status:result.status,headers:{
   ...h,'Access-Control-Allow-Origin':cors,'Vary':'Origin'
  }});
 }catch{
  return reply(503,{error:'intake_unavailable'},cors);
 }
});
