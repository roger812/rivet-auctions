/**
 * Read-only Rivet lead contact card for the authenticated IWCO staff CRM.
 *
 * Private backend contract only: do not expose this as a public endpoint.
 * Caller must first prove the IWCO staff member has ACTIVE Rivet business
 * access; Rivet then verifies an independent signed service-to-service request.
 * No credentials, notes, Twilio/Gmail privileges or write operations leave Rivet.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const TIMESTAMP=/^[1-9]\d{9}$/;
const FIELDS=['schemaVersion','businessId','leadRef','inquiryRef','workspaceId',
  'actorUserId','purpose'];
const MAX_BYTES=1024;
export class RivetDetailError extends Error{
 constructor(code){super(code);this.code=code;}
}
const reject=code=>{throw new RivetDetailError(code);};
function exact(value,keys){
 return value!==null && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).length===keys.length &&
  Object.keys(value).every(k=>keys.includes(k));
}
const optional=(value,max)=>value===null||value===undefined
 ? null : typeof value==='string'&&value.length<=max?value:reject('rivet_detail_data_invalid');

/** A separate 32-byte secret is required; do not reuse the lead-event key. */
export function createRivetAtlasDetailReader({
 enabled=false,pool,secretHex,expectedWorkspaceId,clock=Date.now
}={}){
 if(enabled!==true)return Object.freeze({
  enabled:false,async receive(){reject('rivet_detail_disabled');}
 });
 if(typeof pool?.query!=='function'||!HEX.test(secretHex||'')||
    !UUID.test(expectedWorkspaceId||'')||typeof clock!=='function')
  reject('rivet_detail_not_configured');
 const secret=Buffer.from(secretHex,'hex');
 return Object.freeze({
  enabled:true,
  async receive(request){
   if(request?.method!=='POST'||request.headers.get('Origin')||
      request.headers.get('Sec-Fetch-Site'))
    reject('rivet_detail_machine_only');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get('Content-Type')||''))
    reject('rivet_detail_json_required');
   if(request.headers.get('X-Atlas-Business')!=='rivet-auctions')
    reject('rivet_detail_source_mismatch');
   const ts=request.headers.get('X-Atlas-Timestamp')||'',
     sig=request.headers.get('X-Atlas-Signature')||'';
   if(!TIMESTAMP.test(ts)||Math.abs(Number(clock())-Number(ts)*1000)>300000)
    reject('rivet_detail_expired');
   if(!/^sha256=[a-f0-9]{64}$/.test(sig))
    reject('rivet_detail_bad_signature');
   const raw=Buffer.from(await request.arrayBuffer());
   if(raw.length<2||raw.length>MAX_BYTES)
    reject('rivet_detail_invalid_size');
   const expected=createHmac('sha256',secret).update(ts).update('\n').update(raw).digest();
   if(!timingSafeEqual(expected,Buffer.from(sig.slice(7),'hex')))
    reject('rivet_detail_bad_signature');
   let q;
   try{q=JSON.parse(raw.toString('utf8'));}
   catch{reject('rivet_detail_invalid_json');}
   if(!exact(q,FIELDS)||q.schemaVersion!==1||
      q.businessId!=='rivet-auctions'||q.purpose!=='staff_case_review'||
      q.workspaceId!==expectedWorkspaceId||
      !UUID.test(q.leadRef||'')||!UUID.test(q.inquiryRef||'')||
      !UUID.test(q.actorUserId||''))
    reject('rivet_detail_invalid_request');
   // Both references are mandatory: an indexed lead cannot be replaced by
   // an unrelated source inquiry or guessed contact ID.
   const result=await pool.query(
     'SELECT c.id AS case_id,i.id AS inquiry_id,c.kind,c.stage,'+
     'ct.display_name,ct.email,ct.phone,ct.preferred_reply,'+
     'p.submitted_address,p.city,p.state,p.postal_code,'+
     'i.reply_consent,i.consent_version '+
     'FROM rivet.cases c '+
     'JOIN rivet.inquiries i ON i.case_id=c.id '+
     'JOIN rivet.contacts ct ON ct.id=c.contact_id '+
     'LEFT JOIN rivet.properties p ON p.id=c.property_id '+
     'WHERE c.id=$1 AND i.id=$2 LIMIT 1',
     [q.leadRef,q.inquiryRef]
   );
   if(result.rowCount!==1)reject('rivet_detail_not_found');
   const row=result.rows[0];
   if(!['seller','buyer'].includes(row.kind)||
      typeof row.reply_consent!=='boolean')
    reject('rivet_detail_data_invalid');
   return Object.freeze({
    businessId:'rivet-auctions',leadRef:q.leadRef,inquiryRef:q.inquiryRef,
    inquiryType:row.kind,stage:optional(row.stage,50),
    displayName:optional(row.display_name,120),
    email:optional(row.email,254),phone:optional(row.phone,40),
    preferredReply:optional(row.preferred_reply,40),
    propertyAddress:optional(row.submitted_address,240),
    city:optional(row.city,80),state:optional(row.state,2),
    postalCode:optional(row.postal_code,15),
    replyConsentRecordedBySource:row.reply_consent,
    consentVersion:optional(row.consent_version,120),
    marketingConsent:false
   });
  }
 });
}
