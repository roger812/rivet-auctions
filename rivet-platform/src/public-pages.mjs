/**
 * A deliberately opt-in Rivet Auctions public website preview.
 * The live ChatGPT Sites publisher is separate; this module does not cut over DNS.
 * The inquiry form is exposed only when a real human-challenge site key is configured.
 * The existing /api/inquiries handler alone decides whether a request was persisted.
 */
import { readFileSync } from 'node:fs';

const fromPublic = filename => readFileSync(new URL('../public/' + filename, import.meta.url), 'utf8');
const htmlSource = fromPublic('seller-site.html');
const buyerHtml = fromPublic('buyer-site.html');
const cssSource = fromPublic('rivet-seller.css');
const jsSource = fromPublic('rivet-seller.js');

const csp = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data:",
  "font-src 'self'"
].join('; ');

const baseHeaders = {
  'Cache-Control':'no-store',
  'Content-Security-Policy':csp,
  'Cross-Origin-Resource-Policy':'same-origin',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'X-Robots-Tag':'noindex, nofollow'
};
const htmlResponse = markup => new Response(markup, {status:200,headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8'}});
const textResponse = (text,type) => new Response(text,{status:200,headers:{...baseHeaders,'Content-Type':type}});
const rejectMethod = () => new Response('Method not allowed',{status:405,headers:{...baseHeaders,Allow:'GET','Content-Type':'text/plain; charset=utf-8'}});

function inquiryWidget(siteKey) {
  if (!siteKey) return '<div class="form-unavailable"><strong>Conversation requests are being prepared.</strong><p>The secure online inquiry service is not yet enabled in this development preview. No information is collected by this page.</p></div>';
  const safe = String(siteKey).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return [
    '<h3>Tell us about your home.</h3>',
    '<p>Request an initial conversation, not an auction registration or an agreement to sell.</p>',
    '<form id="rivet-seller-inquiry" novalidate>',
    '<label for="seller-name">Your name</label><input id="seller-name" name="name" autocomplete="name" minlength="2" maxlength="120" required>',
    '<label for="seller-email">Email</label><input id="seller-email" name="email" type="email" autocomplete="email" maxlength="254" required>',
    '<label for="seller-phone">Phone (optional)</label><input id="seller-phone" name="phone" autocomplete="tel" maxlength="32" type="tel">',
    '<label for="seller-address">Property address (optional)</label><input id="seller-address" name="propertyAddress" autocomplete="street-address" maxlength="200">',
    '<label for="seller-reply">How should we reply?</label><select id="seller-reply" name="preferredReply"><option value="email">Email</option><option value="call">Phone call</option><option value="text">Text</option></select>',
    '<label for="seller-note">What are you hoping to accomplish? (optional)</label><textarea id="seller-note" name="note" rows="3" maxlength="1200"></textarea>',
    '<div class="consent-line"><input id="seller-consent" type="checkbox" name="consentToReply" value="yes" required><label for="seller-consent">I authorize Rivet Auctions to reply about this specific inquiry. This does not enroll me in advertising or ongoing marketing.</label></div>',
    '<div class="cf-turnstile" data-sitekey="',safe,'"></div>',
    '<button class="button primary" type="submit">Request my conversation</button>',
    '<p id="inquiry-status" class="form-status" role="status" aria-live="polite"></p>',
    '</form><script async defer src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>'
  ].join('');
}

export function createRivetPublicPages({turnstileSiteKey = ''} = {}) {
  if (turnstileSiteKey && !/^[a-zA-Z0-9_-]{10,180}$/.test(turnstileSiteKey))
    throw new TypeError('invalid_turnstile_public_key');
  const html = htmlSource.replace('<!-- INQUIRY_WIDGET -->', inquiryWidget(turnstileSiteKey));
  if (html === htmlSource) throw new Error('inquiry_placeholder_missing');
  return request => {
    const path = new URL(request.url).pathname;
    if (!['/','/buyers','/assets/rivet-seller.css','/assets/rivet-seller.js'].includes(path)) return null;
    if (request.method !== 'GET') return rejectMethod();
    if (path === '/') return htmlResponse(html);
    if (path === '/buyers') return htmlResponse(buyerHtml);
    if (path.endsWith('.css')) return textResponse(cssSource,'text/css; charset=utf-8');
    return textResponse(jsSource,'text/javascript; charset=utf-8');
  };
}
