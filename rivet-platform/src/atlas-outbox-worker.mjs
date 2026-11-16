/**
 * Rivet -> Atlas one-at-a-time durable outbox worker.
 * DISABLED unless caller explicitly constructs it with an enabled sender.
 * No scheduler or live network service is created on import.
 *
 * A short PostgreSQL lease protects concurrent workers. If a worker dies,
 * its lease expires and the same idempotent event may safely be retried.
 */
import {randomUUID} from 'node:crypto';

export class RivetOutboxError extends Error{
 constructor(code){super(code);this.code=code;}
}
const fail=code=>{throw new RivetOutboxError(code);};
const MAX_ATTEMPTS=8;
const LIMIT_SECONDS=86400;
const LEASE_SECONDS=30;

export function createRivetAtlasOutboxWorker({pool,sender}={}){
 if(typeof pool?.connect!=='function'||sender?.enabled!==true||
    typeof sender?.deliver!=='function')
  fail('rivet_outbox_worker_not_configured');
 return {
  async runOnce(){
   const owner=randomUUID();
   let item=null,attempts=0;
   const client=await pool.connect();
   let transaction=false;
   try{
    await client.query('BEGIN');transaction=true;
    const result=await client.query(
     "SELECT event_id,payload,attempts FROM rivet.lead_outbox "+
     "WHERE (delivery_status IN ('pending','retry') AND next_attempt_at<=now()) "+
     "OR (delivery_status='processing' AND lease_expires_at<=now()) "+
     "ORDER BY created_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED"
    );
    item=result.rows[0]||null;
    if(!item){
     await client.query('COMMIT');transaction=false;
     return {status:'idle'};
    }
    attempts=Number(item.attempts)+1;
    if(!Number.isSafeInteger(attempts)||attempts>MAX_ATTEMPTS){
     await client.query(
      "UPDATE rivet.lead_outbox SET delivery_status='paused',"+
      "lease_owner=NULL,lease_expires_at=NULL,last_error_code='retry_budget_exhausted' "+
      "WHERE event_id=$1",[item.event_id]
     );
     await client.query('COMMIT');transaction=false;
     return {status:'paused'};
    }
    await client.query(
     "UPDATE rivet.lead_outbox SET delivery_status='processing',"+
     "lease_owner=$2,lease_expires_at=now()+($3::integer*interval '1 second'),"+
     "attempts=attempts+1,last_error_code=NULL WHERE event_id=$1",
     [item.event_id,owner,LEASE_SECONDS]
    );
    await client.query('COMMIT');transaction=false;
   }catch(error){
    if(transaction)await client.query('ROLLBACK').catch(()=>{});
    fail('rivet_outbox_claim_failed');
   }finally{client.release();}
   // Do NOT hold a database transaction while making a network request.
   let outcome,errorCode=null;
   try{
    outcome=await sender.deliver(item.payload);
    if(outcome?.delivered!==true)throw new Error('invalid_acknowledgement');
   }catch(error){
    const candidate=String(error?.code||'transport_unavailable');
    errorCode=/^[a-z0-9_]{1,80}$/.test(candidate)?candidate:'transport_unavailable';
   }
   const final=await pool.connect();
   try{
    const seconds=Math.min(LIMIT_SECONDS,15*Math.pow(2,attempts));
    const finished=errorCode===null,paused=!finished&&attempts>=MAX_ATTEMPTS;
    const nextStatus=finished?'delivered':paused?'paused':'retry';
    const result=await final.query(
     "UPDATE rivet.lead_outbox SET delivery_status=$3,"+
     "lease_owner=NULL,lease_expires_at=NULL,"+
     "delivered_at=CASE WHEN $3='delivered' THEN now() ELSE delivered_at END,"+
     "next_attempt_at=CASE WHEN $3='retry' THEN now()+($4::integer*interval '1 second')"+
     " ELSE next_attempt_at END,last_error_code=$5 "+
     "WHERE event_id=$1 AND lease_owner=$2 AND delivery_status='processing' RETURNING event_id",
     [item.event_id,owner,nextStatus,seconds,errorCode]
    );
    if(result.rowCount!==1)fail('rivet_outbox_lease_lost');
    return {status:nextStatus,attempts,
     ...(finished?{replayed:outcome.replayed===true}:{errorCode})};
   }catch(error){
    fail('rivet_outbox_settlement_failed');
   }finally{final.release();}
  }
 };
}
