/**
 * Rivet seller options discussion scaffold. This module deliberately does not
 * predict sale prices, rank offers, select an auction, or establish agency.
 * A human broker/auctioneer must approve each strategy and auction terms.
 */
const TIMING = new Set(['flexible', 'within_90_days', 'within_30_days', 'urgent', 'unknown']);
const CONDITION = new Set(['move_in_ready', 'minor_repairs', 'major_repairs', 'unknown']);
const GOALS = new Set(['best_net', 'certainty', 'speed', 'as_is', 'understand_options', 'not_sure']);
const BID_EVIDENCE = new Set(['verified', 'unverified', 'none', 'unknown']);

export function buildSellerOptionsDiscussion(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('seller_discussion_invalid');
  const timing = input.timing || 'unknown';
  const condition = input.condition || 'unknown';
  const goal = input.goal || 'not_sure';
  const bidEvidence = input.bidEvidence || 'unknown';
  if (!TIMING.has(timing) || !CONDITION.has(condition) || !GOALS.has(goal) || !BID_EVIDENCE.has(bidEvidence))
    throw new TypeError('seller_discussion_invalid_choice');

  const questions = [
    'What outcome matters most: net proceeds, timeline, certainty, or avoiding repairs?',
    'What is the property condition and how would you prefer to handle repairs?',
    'Are there title, mortgage, deadline, occupancy, estate, or representation considerations?',
    'Have you already signed a listing or auction engagement agreement?'
  ];
  const reviewFlags = [];
  if (input.alreadyRepresented === true) reviewFlags.push('existing_representation_review');
  if (input.titleConcerns === true) reviewFlags.push('title_counsel_review');
  if (input.deadlineRisk === true || timing === 'urgent') reviewFlags.push('time_sensitive_response');
  if (input.possibleForeclosure === true) reviewFlags.push('independent_foreclosure_options_review');
  if (condition === 'unknown') reviewFlags.push('property_condition_not_confirmed');
  if (bidEvidence !== 'verified') reviewFlags.push('buyer_demand_not_verified');

  return {
    status: 'needs_human_review',
    recommendedPath: null,
    canAdvertiseAuction: false,
    canClaimBuyerCompetition: bidEvidence === 'verified',
    questions,
    reviewFlags,
    paths: [
      {id:'traditional_listing', title:'Traditional brokerage listing', note:'Compare market exposure, sale conditions, timeline, and expected net without promising a result.'},
      {id:'competitive_sale', title:'Structured competitive sale or auction', note:'Discuss only after buyer demand, reserve, eligibility, auction terms, fees, authority, and legally required disclosures are reviewed.'},
      {id:'as_is_sale', title:'Direct as-is sale', note:'Discuss certainty, repair responsibility, buyer qualification, due diligence, price and net proceeds.'},
      {id:'no_sale', title:'Keep the property or wait', note:'A valid outcome when selling is not in the owner’s best interest.'}
    ],
    disclosures: ['Not an appraisal or price guarantee.', 'No agency, listing, or auction agreement is created by this discussion.', 'Any referral to a separate business requires an appropriate disclosure and the homeowner’s consent.'],
    recordedContext: {timing, condition, goal, bidEvidence}
  };
}
