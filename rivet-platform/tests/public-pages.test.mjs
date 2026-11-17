import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetPublicPages} from '../src/public-pages.mjs';
import {createRivetApplication} from '../src/application.mjs';

const origin='https://rivetauctions.com';
const request=path=>new Request(origin+path,{method:'GET'});
const mocks={
  origin,
  sessions:{readVerified:async()=>null},
  members:{forUser:async()=>null},
  cases:{listForStaff:async()=>[]},
  repository:{saveInquiry:async()=>({id:'receipt',caseId:'case'})},
  verifyHuman:async()=>true,
  rateLimiter:async()=>true
};

test('public web preview is OFF by default even if secure backend is configured',async()=>{
  const app=createRivetApplication(mocks);
  assert.equal((await app(request('/'))).status,404);
  assert.equal((await app(request('/assets/rivet-seller.css'))).status,404);
});

test('public preview returns seller-first page and does not imply an existing brokerage agreement',async()=>{
  const page=createRivetPublicPages();
  const response=page(request('/'));
  assert.equal(response.status,200);
  assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
  const html=await response.text();
  assert.match(html,/Your home deserves/);
  assert.match(html,/Rivet Auctions first/);
  assert.match(html,/same table/);
  assert.match(html,/separately sign the Rivet Real Estate listing agreement/);
  assert.match(html,/Founder-owned auction business/);
  assert.match(html,/A different selling process shouldn't mean less personal attention/);
  assert.doesNotMatch(html,/SIDE, INC\.|Fine Art Consignment|You are guaranteed|highest possible price/);
  assert.doesNotMatch(html,/<form id="rivet-seller-inquiry"/);
  assert.match(html,/No information is collected by this page/);
});

test('assets are served with appropriate types and origin-scoped security headers',async()=>{
  const handler=createRivetPublicPages();
  const css=handler(request('/assets/rivet-seller.css'));
  assert.equal(css.status,200);
  assert.match(css.headers.get('Content-Type'),/text\/css/);
  assert.match(await css.text(),/\.hero-art/);
  const script=handler(request('/assets/rivet-seller.js'));
  assert.equal(script.status,200);
  assert.match(script.headers.get('Content-Type'),/text\/javascript/);
  assert.match(await script.text(),/result\.status !== 'received'/);
  assert.equal(script.headers.get('Cross-Origin-Resource-Policy'),'same-origin');
  assert.equal(handler(request('/api/team/requests')),null);
  assert.equal(handler(new Request(origin+'/',{method:'POST'})).status,405);
});

test('enabled preview can render a consent-only inquiry form behind human verification',async()=>{
  const html=await createRivetPublicPages({turnstileSiteKey:'1x00000000000000000000AA'})(request('/')).text();
  assert.match(html,/<form id="rivet-seller-inquiry"/);
  assert.match(html,/cf-turnstile/);
  assert.match(html,/consentToReply/);
  assert.match(html,/This does not enroll me in advertising/);
  assert.match(html,/Request my conversation/);
  assert.doesNotMatch(html,/status: 'received'/);
  assert.throws(()=>createRivetPublicPages({turnstileSiteKey:'"><script>alert(1)</script>'}),/invalid_turnstile_public_key/);
});

test('preview does not grant access to private team endpoints or override intake',async()=>{
  const app=createRivetApplication({...mocks,publicSiteEnabled:true});
  assert.equal((await app(request('/'))).status,200);
  assert.equal((await app(request('/team'))).status,401);
  assert.equal((await app(request('/api/team/requests'))).status,401);
  assert.equal((await app(request('/api/inquiries'))).status,403);
  assert.equal((await app(request('/arbitrary'))).status,404);
  assert.equal((await app(new Request('https://not-rivet.example/'))).status,403);
});
