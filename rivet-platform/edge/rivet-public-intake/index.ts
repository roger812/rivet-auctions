/**
 * Rivet Auctions consultation-only public intake gateway (low-volume pilot).
 * No auction bids, listing signatures, bulk marketing or cross-brand data access.
 *
 * Security: fixed origin allowlist, signed short-lived challenge, time delay,
 * modest computational puzzle, one-time nonce, no-PII shared rate window,
 * server-only Postgres transaction and fail-closed database kill switch.
 * These controls deter routine spam; they are NOT Cloudflare Turnstile.
 */
import pg from 'npm:pg@8.16.3';
import {createRivetPublicIntake} from './public-intake.mjs';
import {createRivetPostgresRepository} from './postgres-repository.mjs';
const {Pool}=pg;
const encoder=new TextEncoder();
const originSet=new Set([
 'https://rivet-auctions-public-candidate-20261117.onrender.com',
 'https://rivetauctions.com',
 'https://www.rivetauctions.com'
]);
const serviceKey=(()=>{
 const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(legacy.length>=30)return legacy;
 try{
  const dictionary=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const key=dictionary.default || Object.values(dictionary).find(v=>typeof v==='string'&&v.length>=30);
  return typeof key==='string'&&key.length>=30?key:'';
 }catch{return '';}
})();
const dbUrl=Deno.env.get('SUPABASE_DB_URL')||'';
const configured=serviceKey.length>=30 && /^postgres(ql)?:\/\//.test(dbUrl);
const pool=configured?new Pool({connectionString:dbUrl,max:3,connectionTimeoutMillis:6500,idleTimeoutMillis:1800}):null;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const response=(status,body,origin='')=>new Response(JSON.stringify(body),{status,headers:{...headers,...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});
const msg=(nonce,issuedAt,origin)=>nonce+'.'+issuedAt+'.'+origin;
const hex=a=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
const powOk=async(nonce,work)=>{
 if(!Number.isSafeInteger(work)||work<0||work>1000000)return false;
 const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(nonce+':'+work));
 const a=new Uint8Array(bytes);
 return a[0]===0 && a[1]<16; // 12-bit proof: a small client cost, not robust bot protection
};
const mac=async raw=>{
 const key=await crypto.subtle.importKey('raw',encoder.encode(serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(raw)));
};
const same=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
};
async function isEnabled(){
 if(!pool)return false;
 try{
  const r=await pool.query("select enabled from rivet.intake_runtime_control where key='public' limit 1");
  return r.rows[0]?.enabled===true;
 }catch{return false;}
}
const intake=configured?createRivetPublicIntake({
 origin:'https://rivet-auctions-public-candidate-20261117.onrender.com',
 repository:createRivetPostgresRepository({pool}),
 verifyHuman:async(req,token)=>{
  if(typeof token!=='string'||token.length>800)return false;
  try{
   const value=JSON.parse(token);
   if(!value||typeof value.nonce!=='string'||!/^[0-9a-f-]{36}$/i.test(value.nonce)||
      !Number.isSafeInteger(value.issuedAt)||typeof value.sig!=='string')return false;
   const age=Date.now()-value.issuedAt;
   if(age<2500||age>300000)return false;
   const correct=await mac(msg(value.nonce,value.issuedAt,req.headers.get('X-RA-Origin')||''));
   if(!same(correct,value.sig))return false;
   if(!(await powOk(value.nonce,value.work)))return false;
   const used=await pool.query('insert into rivet.intake_used_challenges(nonce) values($1) on conflict do nothing returning nonce',[value.nonce]);
   return used.rowCount===1;
  }catch{return false;}
 },
 rateLimiter:async()=>{
  try{
   const r=await pool.query(
    "insert into rivet.intake_rate_windows(scope,window_start,attempts) values('global',date_trunc('minute',now()),1) "+
    'on conflict(scope,window_start) do update set attempts=rivet.intake_rate_windows.attempts+1 '+
    'where rivet.intake_rate_windows.attempts < 60 returning attempts');
   return r.rowCount===1;
  }catch{return false;}
 }
}):null;
Deno.serve(async request=>{
 const route=new URL(request.url).pathname;
 if(route.endsWith('/health')&&request.method==='GET'){
  if(!pool)return response(503,{status:'unconfigured'});
  try{
   await pool.query('select 1');
   return response(200,{status:'database_reachable',intakeEnabled:await isEnabled()});
  }catch{return response(503,{status:'database_unreachable'});}
 }
 const actualOrigin=request.headers.get('Origin')||'';
 const allowed=originSet.has(actualOrigin)?actualOrigin:'';
 if(!allowed)return response(403,{error:'origin_not_allowed'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Max-Age':'300'
 }});
 if(!configured || !await isEnabled())return response(503,{error:'intake_not_enabled'},allowed);
 if(route.endsWith('/challenge')&&request.method==='GET'){
  const nonce=crypto.randomUUID(),issuedAt=Date.now();
  return response(200,{nonce,issuedAt,sig:await mac(msg(nonce,issuedAt,allowed)),difficulty:12},allowed);
 }
 if(!(route==='/rivet-public-intake'||route.endsWith('/rivet-public-intake'))||request.method!=='POST')
  return response(405,{error:'post_required'},allowed);
 if(Number(request.headers.get('Content-Length')||0)>8192)return response(413,{error:'request_too_large'},allowed);
 if(!request.body)return response(400,{error:'body_required'},allowed);
 const reader=request.body.getReader();let size=0;const chunks=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>8192){await reader.cancel().catch(()=>{});return response(413,{error:'request_too_large'},allowed);}
   chunks.push(value);
  }
 }catch{return response(400,{error:'body_read_failed'},allowed);}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
 const raw=new TextDecoder().decode(bytes);
 const h=new Headers(request.headers);h.delete('host');h.delete('content-length');
 h.set('Origin','https://rivet-auctions-public-candidate-20261117.onrender.com');
 h.set('X-RA-Origin',allowed);
 const proxy=new Request('https://rivet-auctions-public-candidate-20261117.onrender.com/api/inquiries',{method:'POST',headers:h,body:raw});
 try{
  const result=await intake(proxy);
  return new Response(await result.text(),{status:result.status,headers:{...headers,'Access-Control-Allow-Origin':allowed,'Vary':'Origin'}});
 }catch{return response(503,{error:'intake_unavailable'},allowed);}
});
