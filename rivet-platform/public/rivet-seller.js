/* Rivet Auctions seller intake — never display success without a verified server receipt. */
(() => {
  'use strict';
  const form = document.querySelector('#rivet-seller-inquiry');
  if (!form) return;
  const status = document.querySelector('#inquiry-status');
  const button = form.querySelector('button[type="submit"]');
  let requestKey = '';
  const say = (kind, message) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.status = kind;
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  };
  form.addEventListener('input', () => { requestKey = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
      say('error', 'This browser cannot securely prepare your request. Please use a current browser.');
      return;
    }
    const token = form.querySelector('input[name="cf-turnstile-response"]')?.value || '';
    if (!token) {
      say('error', 'Please complete the human verification before sending your request.');
      return;
    }
    const data = new FormData(form);
    const rawSource = new URLSearchParams(window.location.search).get('utm_source') || 'direct';
    const source = ('ra_' + rawSource.toLowerCase().replace(/[^a-z0-9_-]/g, '_')).slice(0,64);
    const payload = {
      kind: 'seller',
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      propertyAddress: String(data.get('propertyAddress') || '').trim(),
      note: String(data.get('note') || '').trim(),
      preferredReply: String(data.get('preferredReply') || 'email'),
      consentToReply: data.get('consentToReply') === 'yes',
      source: source,
      turnstileToken: token
    };
    if (!payload.consentToReply) {
      say('error', 'Please confirm that our team may reply about this inquiry.');
      return;
    }
    if (payload.preferredReply !== 'email' && !payload.phone) {
      say('error', 'Please add your phone number to request a call or text reply.');
      return;
    }
    if (!requestKey) requestKey = window.crypto.randomUUID();
    button.disabled = true;
    say('pending', 'Sending your request securely…');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {'Content-Type':'application/json','Idempotency-Key':requestKey},
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.status !== 'received' || typeof result.reference !== 'string' || result.reference.length === 0) {
        throw new Error('receipt_not_verified');
      }
      say('success', 'Your request was saved. Reference: ' + result.reference + '. A team member can now review it.');
      form.reset();
      requestKey = '';
      if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
    } catch {
      say('error', 'We could not confirm that your inquiry was saved. Please try again. We will not label it received without a confirmed receipt.');
      if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
    } finally {
      button.disabled = false;
    }
  });
})();
