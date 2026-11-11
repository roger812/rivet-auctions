/**
 * Atlas CRM shared lead-index event contract, version 1.
 *
 * SOURCE: application server only, after a successful committed transaction.
 * DESTINATION: NOT CONNECTED. A future trusted, scoped integration can
 * consume this event through an authenticated outbox/receiver.
 *
 * This object intentionally contains NO homeowner identity, contact methods,
 * address, free-form notes, auction price, or personal conversation history.
 * Those remain in the source business and require separately authorized access.
 *
 * businessId, sourceChannel, and the allowed lead types are trusted server
 * configuration. Never accept a client's claimed business, permissions,
 * assignment, or campaign as authority.
 */
const ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_CHANNELS = new Set(['website','postcard','google','social','referral','phone','email','other']);
const SOURCE_CODE = /^[a-z0-9_-]{1,64}$/i;

function iso(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value)) {
    throw new TypeError('invalid_observed_time');
  }
  return date.toISOString();
}

export function createAtlasLeadEnvelopeFactory({businessId, leadTypes, sourceChannel, clock = () => new Date().toISOString()} = {}) {
  if (typeof businessId !== 'string' || !ID.test(businessId) ||
      !leadTypes || typeof leadTypes !== 'object' || Array.isArray(leadTypes) ||
      !Object.values(leadTypes).length ||
      Object.entries(leadTypes).some(([kind, type]) => !ID.test(kind) || typeof type !== 'string' || !ID.test(type)) ||
      !SOURCE_CHANNELS.has(sourceChannel) || typeof clock !== 'function') {
    throw new TypeError('trusted_business_configuration_required');
  }
  const mapping = {...leadTypes};
  return function envelopeFromCommittedInquiry({receipt, inquiry} = {}) {
    if (!receipt || typeof receipt !== 'object' || !UUID.test(receipt.caseId || '') ||
        !UUID.test(receipt.id || '') || !inquiry || typeof inquiry !== 'object' ||
        !Object.hasOwn(mapping, inquiry.kind)) {
      throw new TypeError('committed_inquiry_required');
    }
    // Only store a source code as a non-authoritative attribution hint.
    const reportedSource = typeof inquiry.source === 'string' && SOURCE_CODE.test(inquiry.source)
      ? inquiry.source : 'unattributed';
    return {
      schemaVersion: 1,
      eventType: 'lead.received',
      idempotencyKey: businessId + ':lead.received:' + receipt.caseId,
      businessId,
      sourceSystem: businessId,
      leadRef: receipt.caseId,
      inquiryRef: receipt.id,
      leadType: mapping[inquiry.kind],
      initialStage: 'New',
      assignedUserId: null,
      attribution: {
        channel: sourceChannel,
        reportedSource,
        campaignId: null,
        verification: 'unverified'
      },
      communication: {
        replyConsentRecordedBySource: inquiry.consentToReply === true,
        marketingConsent: false
      },
      occurredAt: iso(clock()),
      security: {
        containsCustomerPII: false,
        fullRecordAccess: 'source_scoped_authorized_read',
        sourceMembershipRequired: true
      }
    };
  };
}

export const makeRivetAuctionLeadEnvelope = createAtlasLeadEnvelopeFactory({
  businessId: 'rivet-auctions',
  sourceChannel: 'website',
  leadTypes: {
    seller: 'auction-seller-inquiry',
    buyer: 'auction-buyer-inquiry'
  }
});
