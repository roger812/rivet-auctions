async function verifyReturn() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  history.replaceState(null, '', location.pathname);
  const result = document.getElementById('result');
  if (!accessToken) {
    result.textContent = fragment.has('error') ? 'This sign-in link is invalid or expired. Request a fresh link from the Rivet team.' : 'Open the link sent to your email to verify your Rivet account.';
    return;
  }
  try {
    const response = await fetch('https://kxcziyznpvbkgtgscdsd.supabase.co/auth/v1/user', {
      headers: { apikey: 'sb_publishable_HrdT86ZGLsDZMN9L0EAbIg_sXTJ3Tak', Authorization: 'Bearer ' + accessToken },
      credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer'
    });
    if (!response.ok) throw new Error('verification_failed');
    const user = await response.json();
    if (!user.id || !user.email_confirmed_at) throw new Error('email_unconfirmed');
    result.textContent = 'Your Rivet Auctions email is verified. You can close this page.';
  } catch {
    result.textContent = 'We could not verify this link. Contact the Rivet team for a fresh sign-in link.';
  }
}
verifyReturn();
