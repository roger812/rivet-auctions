/**
 * One-shot command for a future PRIVATE development cron service only.
 * Defaults to no-op and never reads database credentials while disabled.
 * No continuous polling, contacts, customer names or tokens in logs.
 */
import {runRivetAtlasDevelopmentJob} from '../src/atlas-private-job.mjs';

async function main(){
 if(process.env.RIVET_ATLAS_DELIVERY_ENABLED!=='1'){
  process.stdout.write('rivet_atlas_job_disabled\n');
  return;
 }
 if(process.env.RIVET_ATLAS_MODE!=='development_proof')
  throw new TypeError('rivet_development_mode_required');
 const {Pool}=await import('pg');
 const result=await runRivetAtlasDevelopmentJob({
  env:process.env,
  Pool,
  fetcher:fetch
 });
 // These fields are safe operational metadata only.
 process.stdout.write(JSON.stringify({
  status:result.status,
  ...(Number.isInteger(result.attempts)?{attempts:result.attempts}:{}),
  ...(typeof result.errorCode==='string'?{errorCode:result.errorCode}:{})
 })+'\n');
}
main().catch(error=>{
 // NEVER print driver error objects; they can contain DB passwords.
 const code=typeof error?.code==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(error.code)
  ?error.code:'job_not_ready';
 console.error('rivet_atlas_private_job_failed:'+code);
 process.exitCode=1;
});
