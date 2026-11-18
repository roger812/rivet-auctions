/* Rivet Auctions consultation intake. No success until a saved database receipt. */
(() => {
  'use strict';
  const form = document.getElementById('rivet-seller-inquiry');
  if (!form) return;
  const status = document.getElementById('inquiry-status');
  const button = form.querySelector('button[type="submit"]');
  const endpoint = 'https://kxcziyznpvbkgtgscdsd.supabase.co/functions/v1/rivet-public-intake';
  let requestKey = '';
  const say = (kind, message) => {
    status.textContent = message;
    status.dataset.status = kind;
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  };
  const solve = async nonce => {
    for (let trial = 0; trial < 200000; trial++) {
      const bytes = new TextEncoder().encode(nonce + ':' + trial);
      const result = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      if (result[0] === 0 && result[1] < 16) return trial;
    }
    throw new Error('challenge_unsolved');
  };
  form.addEventListener('input', () => { requestKey = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!window.crypto?.randomUUID || !window.crypto?.subtle) {
      say('error', 'This browser cannot securely submit the inquiry. Please use the email or phone option below.');
      return;
    }
    const data = new FormData(form);
    if (data.get('consentToReply') !== 'yes') {
      say('error', 'Please authorize a reply about your inquiry.');
      return;
    }
    const phone = String(data.get('phone') || '').trim();
    const preferredReply = String(data.get('preferredReply') || 'email');
    if (preferredReply !== 'email' && !phone) {
      say('error', 'Please enter a telephone number for a call or text reply.');
      return;
    }
    const rawSource = new URLSearchParams(location.search).get('utm_source') || 'direct';
    const source = ('ra_' + rawSource.toLowerCase().replace(/[^a-z0-9_-]/g, '_')).slice(0, 64);
    const payload = {
      kind: 'seller',
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone,
      propertyAddress: String(data.get('propertyAddress') || '').trim(),
      note: String(data.get('note') || '').trim(),
      preferredReply,
      consentToReply: true,
      source,
      website: String(data.get('website') || '')
    };
    if (!requestKey) requestKey = crypto.randomUUID();
    button.disabled = true;
    say('pending', 'Securely preparing your inquiry…');
    try {
      const challengeResponse = await fetch(endpoint + '/challenge', {
        method:'GET',mode:'cors',cache:'no-store',credentials:'omit'
      });
      if (!challengeResponse.ok) throw new Error('challenge_service_unavailable');
      const challenge = await challengeResponse.json();
      if (typeof challenge.nonce !== 'string' || typeof challenge.sig !== 'string' ||
          !Number.isSafeInteger(challenge.issuedAt) || challenge.difficulty !== 12) {
        throw new Error('invalid_challenge');
      }
      const work = await solve(challenge.nonce);
      const elapsed = Date.now() - challenge.issuedAt;
      if (elapsed < 2750) await new Promise(resolve => setTimeout(resolve, 2750 - elapsed));
      payload.turnstileToken = JSON.stringify({
        nonce:challenge.nonce,issuedAt:challenge.issuedAt,sig:challenge.sig,work
      });
      say('pending', 'Saving your inquiry…');
      const answer = await fetch(endpoint, {
        method:'POST',mode:'cors',cache:'no-store',credentials:'omit',
        headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},
        body:JSON.stringify(payload)
      });
      const result = await answer.json().catch(() => ({}));
      if (!answer.ok || result.status !== 'received' ||
          typeof result.reference !== 'string' || !result.reference.length) {
        throw new Error('receipt_not_verified');
      }
      say('success', 'Your inquiry has been saved. Reference: ' + result.reference +
        '. Please keep this number. A team member can review your request.');
      form.reset();
      requestKey = '';
    } catch {
      say('error', 'We could not confirm that your inquiry was saved. Please email or call the Rivet Auctions team below, or try again later.');
    } finally {
      button.disabled = false;
    }
  });
})();
