/**
 * One-shot, private Rivet development delivery job.
 * This is NOT a public server and MUST NOT be deployed as a production task.
 *
 * Fail-closed gates:
 * - explicit RIVET_ATLAS_DELIVERY_ENABLED=1
 * - explicit RIVET_ATLAS_MODE=development_proof
 * - exactly the existing Rivet development Supabase project + verified TLS
 * - protected HMAC sender credential required
 * - no implicit polling, background worker, logging of customer data
 *
 * The external scheduler/Render cron service is intentionally not created
 * here. Live customer delivery requires separate review and activation.
 */
import {createRivetDevelopmentPool} from './server-db.mjs';
import {createRivetAtlasSender} from './atlas-signed-delivery.mjs';
import {createRivetAtlasOutboxWorker} from './atlas-outbox-worker.mjs';

export async function runRivetAtlasDevelopmentJob({
  env={},Pool,fetcher,clock=Date.now
}={}){
 if(env.RIVET_ATLAS_DELIVERY_ENABLED!=='1')
  return Object.freeze({status:'disabled'});
 if(env.RIVET_ATLAS_MODE!=='development_proof')
  throw new TypeError('rivet_development_mode_required');
 if(typeof fetcher!=='function')throw new TypeError('backend_fetch_required');

 // Create the sender before establishing a network/DB connection so an
 // invalid or missing HMAC key cannot claim or advance any outbox record.
 const sender=createRivetAtlasSender({
  enabled:true,
  secretHex:env.RIVET_ATLAS_SHARED_KEY_HEX,
  fetcher,clock
 });
 const pool=createRivetDevelopmentPool({
  Pool,connectionString:env.RIVET_DEV_DATABASE_URL,
  caCertificate:env.RIVET_DEV_DB_CA_PEM
 });
 try{
  const worker=createRivetAtlasOutboxWorker({pool,sender});
  return Object.freeze(await worker.runOnce());
 }finally{
  await pool.end();
 }
}
