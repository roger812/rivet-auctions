/**
 * TEMPORARY Rivet Supabase DEV-only server proof.
 *
 * Runtime: Supabase Edge (Deno + Node-compatible pg), not browser or Render.
 * This executes Rivet's actual intake and repository JS against the actual
 * Rivet development Postgres, but wraps ALL test lead writes in an outer
 * rollback. It never contacts IWCO or any external CRM.
 *
 * Authorization: Supabase Edge verify_jwt=true PLUS a 256-bit one-time token,
 * stored only as a SHA-256 hash in a private, expiring table.
 * This endpoint must be redeployed inert after the proof.
 */
import pg from 'npm:pg@8.16.3';
import {randomUUID} from 'node:crypto';
import {createRivetPublicIntake} from './public-intake.mjs';
import {createRivetPostgresRepository} from './postgres-repository.mjs';

const {Pool}=pg;
const ORIGIN='https://rivet-proof.invalid';
const DB=Deno.env.get('SUPABASE_DB_URL');
const pool=DB?new Pool({connectionString:DB,max:2,connectionTimeoutMillis:7000,
  idleTimeoutMillis:1000}):null;

const response=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});

function ownedFacade(client,failOutbox=false){
 return {
  async connect(){
   return {
    async query(sql,args=[]){
     if(sql==='BEGIN')return client.query('SAVEPOINT rivet_edge_proof');
     if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT rivet_edge_proof');
     if(sql==='ROLLBACK'){
      await client.query('ROLLBACK TO SAVEPOINT rivet_edge_proof');
      return client.query('RELEASE SAVEPOINT rivet_edge_proof');
     }
     if(failOutbox && sql.startsWith('INSERT INTO rivet.lead_outbox'))
      throw new Error('proof_fault');
     return client.query(sql,args);
    },
    release(){} // The private outer test owns this transaction.
   };
  },
  query(sql,args=[]){return client.query(sql,args);}
 };
}
function request(key,body){
 return new Request(ORIGIN+'/api/inquiries',{
  method:'POST',
  headers:{Origin:ORIGIN,'Content-Type':'application/json',
   'Idempotency-Key':key},
  body:JSON.stringify(body)
 });
}
async function checkCount(client,table,column,value){
 const allowed={
  contacts:'id',properties:'id',cases:'id',inquiries:'id',
  tasks:'case_id',activities:'case_id',lead_outbox:'case_id'
 };
 if(allowed[table]!==column)throw new Error('proof_bad_test');
 const r=await client.query(
  'SELECT count(*)::int AS n FROM rivet.'+table+' WHERE '+column+'=$1',[value]
 );
 return r.rows[0].n;
}
async function runProof(){
 const client=await pool.connect();
 let started=false;
 let receipt=null;
 const key='rivet-secure-proof-'+randomUUID().replaceAll('-','');
 const fake={kind:'seller',name:'Fictional E2E Proof',
  email:'fictional-proof@example.invalid',
  propertyAddress:'123 Fictional Way',city:'Austin',state:'TX',
  preferredReply:'email',source:'test',consentToReply:true};
 try {
  await client.query('BEGIN');started=true;
  const intake=createRivetPublicIntake({
   origin:ORIGIN,
   repository:createRivetPostgresRepository({pool:ownedFacade(client)}),
   verifyHuman:async()=>true,rateLimiter:async()=>true
  });
  const first=await intake(request(key,fake));
  if(first.status!==201)throw new Error('proof_first_intake_failed');
  receipt=await first.json();
  if(receipt.status!=='received'||receipt.replayed!==false)
   throw new Error('proof_receipt_invalid');
  const linked=await client.query(
   'SELECT c.id AS case_id,c.contact_id,c.property_id,o.payload,o.delivery_status '+
   'FROM rivet.inquiries i JOIN rivet.cases c ON c.id=i.case_id '+
   'JOIN rivet.lead_outbox o ON o.case_id=c.id WHERE i.id=$1',
   [receipt.reference]
  );
  if(linked.rowCount!==1)throw new Error('proof_related_records_missing');
  const row=linked.rows[0];
  if(row.delivery_status!=='pending'||row.payload.businessId!=='rivet-auctions'||
   row.payload.security?.containsCustomerPII!==false||
   JSON.stringify(row.payload).includes(fake.name)||
   JSON.stringify(row.payload).includes(fake.email))
    throw new Error('proof_metadata_boundary_failed');
  for(const [table,column,id] of [
   ['contacts','id',row.contact_id],['properties','id',row.property_id],
   ['cases','id',row.case_id],['inquiries','id',receipt.reference],
   ['tasks','case_id',row.case_id],['activities','case_id',row.case_id],
   ['lead_outbox','case_id',row.case_id]
  ])if(await checkCount(client,table,column,id)!==1)
   throw new Error('proof_record_missing_'+table);
  const repeat=await intake(request(key,fake));
  if(repeat.status!==200||(await repeat.json()).replayed!==true)
   throw new Error('proof_idempotence_failed');
  const changed=await intake(request(key,{...fake,note:'different'}));
  if(changed.status!==409)throw new Error('proof_conflict_failed');
  const failedIntake=createRivetPublicIntake({
   origin:ORIGIN,
   repository:createRivetPostgresRepository({pool:ownedFacade(client,true)}),
   verifyHuman:async()=>true,rateLimiter:async()=>true
  });
  const forced=await failedIntake(request(key+'fault',{...fake,name:'Fictional Fault'}));
  if(forced.status!==503)throw new Error('proof_fault_not_detected');
  const orphan=await client.query(
   "SELECT count(*)::int AS n FROM rivet.contacts WHERE display_name='Fictional Fault'"
  );
  if(orphan.rows[0].n!==0)throw new Error('proof_partial_write_leaked');
  const rights=await client.query(
   "SELECT NOT has_table_privilege('anon','rivet.lead_outbox','SELECT') AS anon_denied,"+
   "NOT has_table_privilege('authenticated','rivet.lead_outbox','SELECT') AS staff_denied"
  );
  if(rights.rows[0].anon_denied!==true||rights.rows[0].staff_denied!==true)
   throw new Error('proof_public_access_insecure');
  await client.query('ROLLBACK');started=false;
  const leftovers=await client.query('SELECT count(*)::int AS n FROM rivet.inquiries WHERE id=$1',[receipt.reference]);
  if(leftovers.rows[0].n!==0)throw new Error('proof_rollback_not_clean');
  return {proof:'passed',location:'rivet-development-supabase',
   tested:['real_server_connection','intake','seven_relations',
    'private_metadata','idempotence','conflict','fault_rollback','rls'],
   fictional_records_remaining:0,iwco_modified:false};
 }finally{
  if(started)await client.query('ROLLBACK').catch(()=>{});
  client.release();
 }
}

Deno.serve(async req=>{
 if(req.method!=='POST'||req.headers.get('Origin')||req.headers.get('Sec-Fetch-Site'))
  return response(403,{proof:'not_authorized'});
 const token=req.headers.get('X-Rivet-Proof-Token')||'';
 if(!/^[a-f0-9]{64}$/.test(token)||!pool)
  return response(403,{proof:'not_authorized'});
 const client=await pool.connect().catch(()=>null);
 if(!client)return response(503,{proof:'connection_unavailable'});
 let approved=false;
 try{
  await client.query('BEGIN');
  const q=await client.query(
   'UPDATE rivet.dev_proof_tokens SET consumed_at=now() '+
   "WHERE token_hash=encode(digest($1,'sha256'),'hex') "+
   'AND consumed_at IS NULL AND expires_at>now() RETURNING token_hash',
   [token]
  );
  approved=q.rowCount===1;
  await client.query('COMMIT');
 }catch{
  await client.query('ROLLBACK').catch(()=>{});
 }finally{client.release();}
 if(!approved)return response(403,{proof:'not_authorized'});
 try{return response(200,await runProof());}
 catch(e){
  const code=String(e?.message||'unknown');
  console.error('rivet-proof-failed',/^proof_[a-z0-9_]+$/.test(code)?code:'internal_error');
  return response(503,{proof:'failed',reason:/^proof_[a-z0-9_]+$/.test(code)?code:'internal_error'});
 }
});
