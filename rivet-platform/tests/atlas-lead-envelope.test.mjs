import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasLeadEnvelopeFactory, makeRivetAuctionLeadEnvelope} from '../src/atlas-lead-envelope.mjs';

const receipt = {
  caseId: 'a7ce8d02-9b44-4e85-879f-c2645947807a',
  id: 'b1b41fdd-f0b8-47df-9a36-35c4dedcbba4'
};
const inquiry = {
  kind:'seller', source:'rivet_dm_yellow_a01', consentToReply:true,
  name:'Sensitive Person', email:'secret@example.invalid',
  phone:'+15125550100', propertyAddress:'123 Private St',
  note:'A private financial circumstance'
};

test('Rivet seller events have business, source and lead type as separate dimensions', () => {
  const event = makeRivetAuctionLeadEnvelope({receipt, inquiry});
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.businessId, 'rivet-auctions');
  assert.equal(event.leadType, 'auction-seller-inquiry');
  assert.equal(event.attribution.channel, 'website');
  assert.equal(event.attribution.reportedSource, 'rivet_dm_yellow_a01');
  assert.equal(event.attribution.verification, 'unverified');
  assert.equal(event.initialStage, 'New');
  assert.equal(event.assignedUserId, null);
});
test('Buyer registration is separate from seller inquiry and not an offer or verified bid', () => {
  const event=makeRivetAuctionLeadEnvelope({receipt,inquiry:{...inquiry,kind:'buyer',highestOffer:999999}});
  assert.equal(event.leadType,'auction-buyer-inquiry');
  assert.doesNotMatch(JSON.stringify(event),/highestOffer|999999|verified.*bid/);
});
test('Index events have no contact details, notes, property addresses or other PII', () => {
  const s=JSON.stringify(makeRivetAuctionLeadEnvelope({receipt,inquiry}));
  for (const leak of ['Sensitive Person','secret@example.invalid','+15125550100','123 Private St','A private financial circumstance'])
    assert.ok(!s.includes(leak), 'Leaked: '+leak);
  assert.equal(JSON.parse(s).security.containsCustomerPII,false);
});
test('Lead idempotency ID is stable across retries', () => {
  const a=makeRivetAuctionLeadEnvelope({receipt,inquiry});
  const b=makeRivetAuctionLeadEnvelope({receipt,inquiry:{...inquiry,source:'different_tag'}});
  assert.equal(a.idempotencyKey,b.idempotencyKey);
  assert.equal(a.idempotencyKey,'rivet-auctions:lead.received:'+receipt.caseId);
});
test('Client-provided business, owner and marketing consent cannot grant access', () => {
  const event=makeRivetAuctionLeadEnvelope({receipt,inquiry:{
    ...inquiry,businessId:'iwco',ownerUserId:'admin-user',marketingConsent:true
  }});
  assert.equal(event.businessId,'rivet-auctions');
  assert.equal(event.assignedUserId,null);
  assert.equal(event.communication.marketingConsent,false);
  assert.equal(event.security.sourceMembershipRequired,true);
});
test('Reported source is attribution only, not a trusted origin', () => {
  const event=makeRivetAuctionLeadEnvelope({receipt,inquiry:{...inquiry,source:'external.example/?private=a'}});
  assert.equal(event.attribution.reportedSource,'unattributed');
  assert.equal(event.businessId,'rivet-auctions');
  assert.equal(event.attribution.verification,'unverified');
});
test('Reject empty or malformed receipt and unsupported lead kind', () => {
  for (const input of [
    {},{inquiry},{receipt:{caseId:'not-a-uuid',id:receipt.id},inquiry},
    {receipt,inquiry:{...inquiry,kind:'admin'}},
    {receipt,inquiry:null}
  ]) assert.throws(()=>makeRivetAuctionLeadEnvelope(input),/committed_inquiry_required/);
});
test('Business names and lead mappings come from trusted server configuration', () => {
  assert.throws(()=>createAtlasLeadEnvelopeFactory({businessId:'https://spoofed',leadTypes:{a:'b'},sourceChannel:'website'}),/configuration/);
  assert.throws(()=>createAtlasLeadEnvelopeFactory({businessId:'deep-tutoring',leadTypes:{contact:'student-inquiry'},sourceChannel:'spoofed'}),/configuration/);
});
test('Same envelope contract can work for a different business without sharing a database', () => {
  const deepFactory=createAtlasLeadEnvelopeFactory({
    businessId:'deep-tutoring',
    leadTypes:{student:'student-inquiry'},
    sourceChannel:'website',
    clock:()=> '2026-11-11T15:00:00.000Z'
  });
  const e=deepFactory({receipt,inquiry:{kind:'student',source:'organic',consentToReply:true,name:'Private Student'}});
  assert.equal(e.businessId,'deep-tutoring');
  assert.equal(e.leadType,'student-inquiry');
  assert.equal(e.occurredAt,'2026-11-11T15:00:00.000Z');
  assert.ok(!JSON.stringify(e).includes('Private Student'));
});
test('Invalid observation time fails closed', () => {
  const bad=createAtlasLeadEnvelopeFactory({businessId:'rivet-auctions',leadTypes:{seller:'seller-inquiry'},sourceChannel:'website',clock:()=> 'nonsense'});
  assert.throws(()=>bad({receipt,inquiry}),/invalid_observed_time/);
});
