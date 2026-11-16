/**
 * Rivet private worker -> IWCO staff index, metadata-only event transport.
 *
 * Inert on import. No worker, schedule, secret or network action is enabled
 * by this module; production activation is a SEPARATE reviewed step.
 */
import {createHmac} from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_APPROVED='https://iwco-private-preview-proof-morm.onrender.com/api/integrations/atlas/leads';
const ROOT_FIELDS=[
 'schemaVersion','eventType','idempotencyKey','businessId','sourceSystem',
 'leadRef','inquiryRef','leadType','initialStage','assignedUserId','attribution',
 'communication','occurredAt','security'
];
const SOURCE=/^[A-Za-z0-9_-]{1,64}$/;
const CHANNELS=new Set(['website','postcard','google','social','referral','phone','email','other']);
export class RivetDeliveryError extends Error{
 constructor(code){super(code);this.code=code;}
}
const deny=code=>{throw new RivetDeliveryError(code);};
const exact=(value,fields)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===fields.length&&Object.keys(value).every(key=>fields.includes(key));

function assertMetadata(e){
 if(!exact(e,ROOT_FIELDS)||e.schemaVersion!==1||
    e.eventType!=='lead.received'||e.businessId!=='rivet-auctions'||
    e.sourceSystem!=='rivet-auctions'||!UUID.test(e.leadRef||'')||
    !UUID.test(e.inquiryRef||'')||
    e.idempotencyKey!=='rivet-auctions:lead.received:'+e.leadRef||
    !['auction-seller-inquiry','auction-buyer-inquiry'].includes(e.leadType)||
    e.initialStage!=='New'||e.assignedUserId!==null||
    !exact(e.attribution,['channel','reportedSource','campaignId','verification'])||
    !CHANNELS.has(e.attribution.channel)||!SOURCE.test(e.attribution.reportedSource||'')||
    e.attribution.campaignId!==null||e.attribution.verification!=='unverified'||
    !exact(e.communication,['replyConsentRecordedBySource','marketingConsent'])||
    typeof e.communication.replyConsentRecordedBySource!=='boolean'||
    e.communication.marketingConsent!==false||
    !exact(e.security,['containsCustomerPII','fullRecordAccess','sourceMembershipRequired'])||
    e.security.containsCustomerPII!==false||
    e.security.fullRecordAccess!=='source_scoped_authorized_read'||
    e.security.sourceMembershipRequired!==true||
    typeof e.occurredAt!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(e.occurredAt)||
    !Number.isFinite(Date.parse(e.occurredAt)))
   deny('rivet_lead_metadata_invalid');
 return e;
}

/**
 * Endpoint is pinned to the approved private IWCO Render preview, not an
 * arbitrary URL. A production host change requires a separate code review.
 */
export function createRivetAtlasSender({
 enabled=false,secretHex,fetcher,clock=Date.now,endpoint=URL_APPROVED
}={}){
 if(enabled!==true) return Object.freeze({enabled:false,
  async deliver(){deny('rivet_atlas_delivery_not_enabled');}});
 if(!HEX.test(secretHex||'')||typeof fetcher!=='function'||
    typeof clock!=='function'||endpoint!==URL_APPROVED)
  deny('rivet_atlas_delivery_not_configured');
 const secret=Buffer.from(secretHex,'hex');
 return Object.freeze({
  enabled:true,
  async deliver(event){
   assertMetadata(event);
   const body=JSON.stringify(event);
   if(Buffer.byteLength(body)>4096)deny('rivet_atlas_event_too_large');
   const timestamp=String(Math.floor(clock()/1000));
   if(!/^[1-9]\d{9}$/.test(timestamp))deny('rivet_atlas_timestamp_invalid');
   const signature=createHmac('sha256',secret)
    .update(timestamp).update('\n').update(body).digest('hex');
   let response;
   try{
    response=await fetcher(endpoint,{
     method:'POST',redirect:'error',
     headers:{'Content-Type':'application/json',
      'X-Atlas-Business':'rivet-auctions','X-Atlas-Timestamp':timestamp,
      'X-Atlas-Signature':'sha256='+signature},
     body,signal:AbortSignal.timeout(8000)
    });
   }catch{deny('rivet_atlas_transport_unavailable');}
   if(![200,201].includes(response.status))
    deny('rivet_atlas_destination_unavailable');
   let result;
   try{result=await response.json();}
   catch{deny('rivet_atlas_unexpected_reply');}
   if(result?.indexed!==true||result.leadRef!==event.leadRef||
      typeof result.replayed!=='boolean')
    deny('rivet_atlas_unexpected_reply');
   return {delivered:true,replayed:result.replayed,leadRef:result.leadRef};
  }
 });
}
