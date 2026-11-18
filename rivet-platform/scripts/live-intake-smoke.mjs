/**
 * External Rivet intake smoke against deployed Supabase Edge.
 * Uses fictitious test-only values, never customer PII.
 * Fail-closed: only tests POST if DB release control was enabled.
 * A failed run does not claim a functional lead.
 */
import {randomUUID,createHash} from 'node:crypto';

const endpoint='https://kxcziyznpvbkgtgscdsd.supabase.co/functions/v1/rivet-public-intake';
const origin='https://rivet-auctions-public-candidate-20261117.onrender.com';
const asJson=async response=>response.json().catch(()=>({}));
const health=await fetch(endpoint+'/health',{cache:'no-store',redirect:'error'});
const h=await asJson(health);
console.log('Health:',health.status,JSON.stringify({status:h.status,intakeEnabled:h.intakeEnabled}));
if(!health.ok || h.status!=='database_reachable')throw Error('Rivet Supabase Edge-to-Postgres health not verified');
if(h.intakeEnabled!==true){
 console.log('HOLD: intake switch OFF. No submission attempted.');
 process.exit(0);
}
const challengeResponse=await fetch(endpoint+'/challenge',{headers:{Origin:origin},cache:'no-store'});
const challenge=await asJson(challengeResponse);
if(!challengeResponse.ok||!challenge.nonce||!challenge.sig)throw Error('Challenge unavailable: '+challengeResponse.status);
let work=-1;
for(let n=0;n<150000;n++){
 const digest=createHash('sha256').update(challenge.nonce+':'+n).digest();
 if(digest[0]===0&&digest[1]<16){work=n;break;}
}
if(work<0)throw Error('Challenge solution failed');
const wait=2750-(Date.now()-challenge.issuedAt);
if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
const requestKey=randomUUID();
const payload={
 kind:'seller',name:'Rivet Launch Smoke Test',email:'launch-smoke@example.com',phone:'',
 propertyAddress:'123 TEST-ONLY Avenue',note:'INTERNAL TEST ONLY - can delete',
 preferredReply:'email',consentToReply:true,source:'ra_internal_smoke',
 website:'',turnstileToken:JSON.stringify({nonce:challenge.nonce,issuedAt:challenge.issuedAt,sig:challenge.sig,work})
};
const response=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':requestKey},body:JSON.stringify(payload),redirect:'error'});
const result=await asJson(response);
console.log('Intake POST:',response.status,JSON.stringify({status:result.status,reference:result.reference,error:result.error}));
if(response.status!==201||result.status!=='received'||!result.reference)throw Error('No verified database receipt');
console.log('VERIFIED EDGE RECEIPT',result.reference,'- check Rivet tables before production promotion');
