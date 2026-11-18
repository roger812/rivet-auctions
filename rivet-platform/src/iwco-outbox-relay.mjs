/** Rivet -> IWCO metadata relay. Inert until a separately approved worker calls tick().
 * One in-flight event per leased worker. No homeowner data or customer messaging.
 */
import {createHmac} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const RECEIVER='https://iwco-private-preview-proof-morm.onrender.com/api/integrations/rivet-auctions/lead';
const EXACT_KEYS=['schemaVersion','eventType','idempotencyKey','businessId','sourceSystem','leadRef',
 'inquiryRef','leadType','initialStage','assignedUserId','attribution','communication','occurredAt','security'];
const exact=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));

export class RivetRelayError extends Error {
 constructor(code){super(code);this.code=code;}
}
const failure=code=>{throw new RivetRelayError(code);};

/** The source transaction already stored this payload in a private PII-free outbox. */
export function validateRivetOutboxEvent(row){
 if(!row||!UUID.test(row.event_id||'')||!UUID.test(row.case_id||'')||
   typeof row.idempotency_key!=='string'||row.event_type!=='lead.received')
  failure('rivet_outbox_event_invalid');
 const p=row.payload;
 if(!exact(p,EXACT_KEYS)||p.schemaVersion!==1||p.businessId!=='rivet-auctions'||
   p.sourceSystem!=='rivet-auctions'||p.eventType!=='lead.received'||
   p.leadRef!==row.case_id||!UUID.test(p.inquiryRef||'')||
   !['auction-seller-inquiry','auction-buyer-inquiry'].includes(p.leadType)||
   p.idempotencyKey!==row.idempotency_key||
   p.idempotencyKey!=='rivet-auctions:lead.received:'+row.case_id||
   p.initialStage!=='New'||p.assignedUserId!==null||
   !exact(p.attribution,['channel','reportedSource','campaignId','verification'])||
   !['website','postcard','google','social','referral','phone','email','other'].includes(p.attribution.channel)||
   !/^[a-z0-9_-]{1,64}$/i.test(p.attribution.reportedSource||'')||
   p.attribution.campaignId!==null||p.attribution.verification!=='unverified'||
   !exact(p.communication,['replyConsentRecordedBySource','marketingConsent'])||
   typeof p.communication.replyConsentRecordedBySource!=='boolean'||p.communication.marketingConsent!==false||
   !exact(p.security,['containsCustomerPII','fullRecordAccess','sourceMembershipRequired'])||
   p.security.containsCustomerPII!==false||
   p.security.fullRecordAccess!=='source_scoped_authorized_read'||p.security.sourceMembershipRequired!==true||
   typeof p.occurredAt!=='string'||!Number.isFinite(Date.parse(p.occurredAt)))
  failure('rivet_outbox_event_invalid');
 return {eventId:row.event_id,payload:p};
}

/** The HTTP sender never receives a database credential; the DB store is separate. */
export function createIwcoMetadataTransport({secretHex,fetcher=fetch,clock=Date.now,endpoint=RECEIVER}={}){
 if(!HEX.test(secretHex||'')||typeof fetcher!=='function'||typeof clock!=='function'||endpoint!==RECEIVER)
  failure('rivet_relay_transport_not_configured');
 const key=Buffer.from(secretHex,'hex');
 return Object.freeze({async send(event){
  const body=JSON.stringify(event);
  if(Buffer.byteLength(body)>4096)failure('rivet_outbox_event_oversized');
  const ts=String(Math.floor(Number(clock())/1000));
  const sig=createHmac('sha256',key).update(ts).update('\n').update(body).digest('hex');
  let response;
  try{
   response=await fetcher(endpoint,{
    method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
    headers:{'Content-Type':'application/json','X-Rivet-Business':'rivet-auctions',
     'X-Rivet-Timestamp':ts,'X-Rivet-Signature':'sha256='+sig},
    body,signal:AbortSignal.timeout(12000)
   });
  }catch{failure('rivet_relay_network_uncertain');}
  if(![200,201].includes(response.status))failure('rivet_relay_receipt_not_verified');
  let receipt;
  try{receipt=await response.json();}catch{failure('rivet_relay_receipt_not_verified');}
  if(receipt?.status!=='received'||receipt.businessId!=='rivet-auctions'||
     receipt.leadRef!==event.payload.leadRef||receipt.inquiryRef!==event.payload.inquiryRef||
     typeof receipt.replayed!=='boolean')
    failure('rivet_relay_receipt_not_verified');
  return receipt;
 }});
}
/** The store must lease atomically and only acknowledge the exact lease. */
export function createRivetOutboxRelay({enabled=false,store,transport}={}){
 if(enabled!==true)return Object.freeze({enabled:false,async tick(){return {state:'disabled'};}});
 if(typeof store?.claim!=='function'||typeof store?.ack!=='function'||
    typeof store?.defer!=='function'||typeof transport?.send!=='function')
  failure('rivet_relay_store_or_transport_required');
 return Object.freeze({enabled:true,async tick(){
  const row=await store.claim();
  if(!row)return {state:'idle'};
  try{
   const event=validateRivetOutboxEvent(row);
   const receipt=await transport.send(event);
   const saved=await store.ack(row.event_id);
   if(saved!==true)failure('rivet_relay_ack_uncertain');
   return {state:'delivered',eventId:row.event_id,replayed:receipt.replayed};
  }catch(error){
   const code=error instanceof RivetRelayError?error.code:'rivet_relay_unexpected_failure';
   await store.defer(row.event_id,code);
   return {state:'deferred',eventId:row.event_id,code};
  }
 }});
}
/** A restricted DB role should have SELECT/UPDATE on the outbox ONLY.
 * Leases survive process restarts; no automatic background schedule is created.
 */
export function createRivetPgOutboxStore({pool,workerId}={}){
 if(typeof pool?.connect!=='function'||!UUID.test(workerId||''))
  failure('rivet_relay_database_not_configured');
 const query=async(sql,args)=>{
  const client=await pool.connect();
  try{return await client.query(sql,args);}finally{client.release();}
 };
 return Object.freeze({
  async claim(){
   const sql=`WITH next_event AS (
    SELECT o.event_id FROM rivet.lead_outbox o
    JOIN rivet.cases c ON c.id=o.case_id
    WHERE c.source NOT IN ('ra_internal_smoke','ra_test')
    AND (o.delivery_status IN ('pending','retry') OR
      (o.delivery_status='processing' AND o.lease_expires_at<now()))
    AND o.next_attempt_at<=now()
    ORDER BY o.created_at,o.event_id
    FOR UPDATE OF o SKIP LOCKED LIMIT 1
   )
   UPDATE rivet.lead_outbox o SET
      delivery_status='processing',lease_owner=$1,
      lease_expires_at=now()+interval '45 seconds',attempts=o.attempts+1
   FROM next_event n WHERE o.event_id=n.event_id
   RETURNING o.event_id,o.case_id,o.event_type,o.idempotency_key,o.payload,o.attempts`;
   const r=await query(sql,[workerId]);return r.rows[0]||null;
  },
  async ack(id){
   if(!UUID.test(id||''))failure('rivet_relay_event_id_invalid');
   const r=await query(`UPDATE rivet.lead_outbox SET
    delivery_status='delivered',delivered_at=now(),lease_owner=null,lease_expires_at=null,
    last_error_code=null
    WHERE event_id=$1 AND lease_owner=$2 AND delivery_status='processing'
     AND lease_expires_at>now() RETURNING event_id`,[id,workerId]);
   return r.rows.length===1;
  },
  async defer(id,reason){
   if(!UUID.test(id||''))failure('rivet_relay_event_id_invalid');
   const code=/^[a-z0-9_]{4,80}$/.test(reason||'')?reason:'rivet_relay_uncertain';
   const r=await query(`UPDATE rivet.lead_outbox SET
     delivery_status=CASE WHEN attempts>=8 THEN 'paused' ELSE 'retry' END,
     next_attempt_at=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(6,attempts-1)))::int),
     last_error_code=$3,lease_owner=null,lease_expires_at=null
     WHERE event_id=$1 AND lease_owner=$2 AND delivery_status='processing'
     RETURNING event_id`,[id,workerId,code]);
   return r.rows.length===1;
  }
 });
}
