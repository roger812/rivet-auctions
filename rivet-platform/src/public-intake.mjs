/**
 * Rivet Auctions public intake boundary. Reuses IWCO's principles:
 * minimum necessary input, explicit reply consent, bot/rate gates,
 * idempotency, and an atomic CRM handoff.
 *
 * A real provider MUST supply verifyHuman and rateLimiter; there is no
 * permissive production fallback.
 */
export class IntakeError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const allowed = new Set([
  'kind','name','email','phone','propertyAddress','city','state','postalCode',
  'note','preferredReply','consentToReply','source','website','turnstileToken'
]);
const clip = (value, size) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new IntakeError(422, 'invalid_field');
  const s = value.trim().replace(/\s+/g, ' ');
  if (s.length > size) throw new IntakeError(422, 'field_too_long');
  return s;
};

export function normalizeRivetInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new IntakeError(422, 'invalid_request');
  if (Object.keys(body).some(key => !allowed.has(key)))
    throw new IntakeError(422, 'unsupported_field');
  if (body.website) throw new IntakeError(422, 'invalid_request'); // honeypot
  if (!['seller','buyer'].includes(body.kind))
    throw new IntakeError(422, 'choose_inquiry_type');
  if (body.consentToReply !== true)
    throw new IntakeError(422, 'reply_permission_required');

  const name = clip(body.name, 120);
  const email = clip(body.email, 254).toLowerCase();
  const phone = clip(body.phone, 32).replace(/[^\d+]/g, '');
  const digits = phone.replace(/\D/g, '');
  const preferredReply = clip(body.preferredReply, 10) || (email ? 'email' : 'call');
  const propertyAddress = clip(body.propertyAddress, 200);
  const city = clip(body.city, 80);
  const state = (clip(body.state, 2) || 'TX').toUpperCase();
  const postalCode = clip(body.postalCode, 10);
  const note = clip(body.note, 1200);
  const sourceValue = clip(body.source, 64);
  const source = /^[a-z0-9_-]{1,64}$/i.test(sourceValue) ? sourceValue : 'direct';
  if (name.length < 2 || (!email && !phone))
    throw new IntakeError(422, 'name_and_contact_required');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new IntakeError(422, 'invalid_email');
  if (phone && (digits.length < 10 || digits.length > 15))
    throw new IntakeError(422, 'invalid_phone');
  if (!['email','call','text'].includes(preferredReply))
    throw new IntakeError(422, 'invalid_reply_method');
  if (preferredReply === 'email' && !email)
    throw new IntakeError(422, 'email_required');
  if (preferredReply !== 'email' && !phone)
    throw new IntakeError(422, 'phone_required');
  if (state !== 'TX' || (postalCode && !/^\d{5}(?:-\d{4})?$/.test(postalCode)))
    throw new IntakeError(422, 'invalid_location');
  return {
    kind: body.kind, name, email, phone, propertyAddress, city, state, postalCode,
    note, preferredReply, source, consentVersion: 'rivet-reply-v1',
    consentToReply: true, bulkMarketing: false, claimedOwnership: 'unverified'
  };
}

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
const respond = (status, data) => new Response(JSON.stringify(data), {status, headers});

export function createRivetPublicIntake({origin, repository, verifyHuman, rateLimiter} = {}) {
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(origin || '') ||
      typeof repository?.saveInquiry !== 'function' ||
      typeof verifyHuman !== 'function' ||
      typeof rateLimiter !== 'function') {
    throw new TypeError('public_intake_not_configured');
  }
  return async function handlePublicIntake(request) {
    try {
      const url = new URL(request.url);
      if (url.origin !== origin || request.headers.get('Origin') !== origin)
        return respond(403, {error:'origin_not_allowed'});
      if (url.pathname !== '/api/inquiries') return respond(404, {error:'not_found'});
      if (request.method !== 'POST') return respond(405, {error:'method_not_allowed'});
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || ''))
        return respond(415, {error:'json_required'});
      const requestKey = request.headers.get('Idempotency-Key') || '';
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(requestKey))
        return respond(400, {error:'request_id_required'});
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 8192)
        return respond(413, {error:'request_too_large'});
      let body;
      try { body = JSON.parse(raw); }
      catch { return respond(400, {error:'invalid_json'}); }
      const normalized = normalizeRivetInquiry(body);
      // Implementers must use the real trusted connection identity, not an
      // arbitrary client-supplied X-Forwarded-For header, for rate limits.
      if (await rateLimiter(request) !== true)
        return respond(429, {error:'try_again_later'});
      if (await verifyHuman(request, body.turnstileToken) !== true)
        return respond(403, {error:'verification_failed'});
      const receipt = await repository.saveInquiry(normalized, requestKey);
      if (!receipt?.id || !receipt?.caseId)
        return respond(503, {error:'intake_unavailable'});
      return respond(receipt.replayed ? 200 : 201,
        {reference:receipt.id, status:'received', replayed:receipt.replayed === true});
    } catch (error) {
      if (error instanceof IntakeError)
        return respond(error.status, {error:error.code});
      if (error?.code === 'request_changed_use_new_id')
        return respond(409, {error:'request_changed_use_new_id'});
      return respond(503, {error:'intake_unavailable'}); // never expose private DB errors
    }
  };
}
