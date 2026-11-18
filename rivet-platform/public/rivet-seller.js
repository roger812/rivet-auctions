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
  let completed = false;
  // A real saved receipt is the sole condition for any success confirmation.
  const confirmSaved = reference => {
    const notice = document.createElement('section');
    notice.className = 'ra-success-message';
    notice.tabIndex = -1;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = '<span class="ra-success-mark" aria-hidden="true">✓</span>' +
      '<h3>Success! Your form has been submitted.</h3>' +
      '<p>Your consultation request was received by Rivet Auctions. Please keep your receipt number for reference.</p>' +
      '<p class="ra-success-receipt">Receipt: <strong></strong></p>' +
      '<p>Thank you for reaching out. Our team can review your request.</p>';
    notice.querySelector('strong').textContent = reference;
    const intro = form.previousElementSibling;
    if (intro && intro.tagName === 'P') intro.hidden = true;
    const introHeading = intro?.previousElementSibling;
    if (introHeading && /^H[1-6]$/.test(introHeading.tagName)) introHeading.hidden = true;
    form.hidden = true;
    form.insertAdjacentElement('afterend', notice);

    // Keep the in-place confirmation visible even after the modal is dismissed.
    const dialog = document.createElement('dialog');
    dialog.className = 'ra-success-dialog';
    dialog.setAttribute('aria-label', 'Your form was submitted successfully');
    const panel = notice.cloneNode(true);
    panel.removeAttribute('role');
    panel.removeAttribute('aria-live');
    panel.removeAttribute('tabindex');
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'button primary ra-success-done';
    done.textContent = 'Done';
    dialog.append(panel, done);
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      dialog.remove();
      notice.focus({preventScroll: true});
      notice.scrollIntoView({block: 'center', behavior: 'smooth'});
    }, {once: true});
    done.addEventListener('click', () => dialog.close());
    if (typeof dialog.showModal === 'function') {
      try { dialog.showModal(); done.focus(); }
      catch { dialog.remove(); notice.focus(); }
    } else {
      dialog.remove();
      notice.focus();
    }
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
    if (completed || !form.reportValidity()) return;
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
      completed = true;
      requestKey = '';
      confirmSaved(result.reference);
    } catch {
      say('error', 'We could not confirm that your inquiry was saved. Please email or call the Rivet Auctions team below, or try again later.');
    } finally {
      button.disabled = completed;
    }
  });
})();
