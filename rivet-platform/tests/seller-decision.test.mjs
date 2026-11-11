import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSellerOptionsDiscussion} from '../src/seller-decision.mjs';

test('options always require a human decision and never default to auction',()=>{
  const r=buildSellerOptionsDiscussion({goal:'best_net'});
  assert.equal(r.status,'needs_human_review');
  assert.equal(r.recommendedPath,null);
  assert.equal(r.canAdvertiseAuction,false);
  assert.equal(r.paths.length,4);
  assert.ok(r.paths.some(p=>p.id==='no_sale'));
});
test('urgent and potentially foreclosing seller is routed to sensitive review',()=>{
  const r=buildSellerOptionsDiscussion({timing:'urgent',possibleForeclosure:true});
  assert.ok(r.reviewFlags.includes('time_sensitive_response'));
  assert.ok(r.reviewFlags.includes('independent_foreclosure_options_review'));
  assert.doesNotMatch(JSON.stringify(r),/guaranteed|must auction/i);
});
test('buyer interest is never represented as verified without evidence',()=>{
  assert.equal(buildSellerOptionsDiscussion({bidEvidence:'unverified'}).canClaimBuyerCompetition,false);
  assert.equal(buildSellerOptionsDiscussion({bidEvidence:'verified'}).canClaimBuyerCompetition,true);
  assert.equal(buildSellerOptionsDiscussion({}).canClaimBuyerCompetition,false);
});
test('representation/title conflicts are explicit and do not disappear',()=>{
  const r=buildSellerOptionsDiscussion({alreadyRepresented:true,titleConcerns:true});
  assert.ok(r.reviewFlags.includes('existing_representation_review'));
  assert.ok(r.reviewFlags.includes('title_counsel_review'));
});
test('invalid enum input is rejected instead of silently selecting a path',()=>{
  assert.throws(()=>buildSellerOptionsDiscussion({goal:'auction_now'}),/invalid_choice/);
  assert.throws(()=>buildSellerOptionsDiscussion(null),/invalid/);
});
test('owner choice not to sell is a valid and visible outcome',()=>{
  const r=buildSellerOptionsDiscussion({goal:'not_sure'});
  assert.ok(r.paths.find(p=>p.id==='no_sale'));
  assert.ok(r.disclosures.some(s=>s.includes('consent')));
});
