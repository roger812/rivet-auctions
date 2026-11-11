/**
 * Rivet Auctions staff-only route boundary.
 * Adapted from the server-side guard pattern in IWCO's managed API candidate.
 *
 * This is a DEVELOPMENT MODULE, not a production login provider or a live site.
 * sessions.readVerified MUST independently validate the signed session at the server.
 * members.forUser MUST query a Rivet-owned membership store, never a browser claim.
 */
const OPERATORS = new Set(['administrator', 'operator']);
const securityHeaders = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow'
};
const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {...securityHeaders, 'Content-Type': 'application/json; charset=utf-8'}
});
const denied = (status) => json({error: status === 401 ? 'staff_login_required' : 'staff_access_denied'}, status);

export function createRivetStaffBoundary({origin, sessions, members, cases} = {}) {
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(origin || '') ||
      typeof sessions?.readVerified !== 'function' ||
      typeof members?.forUser !== 'function') {
    throw new TypeError('secure_staff_boundary_not_configured');
  }

  async function authorize(request) {
    // The session service must verify the signature, expiry, and revocation.
    const session = await sessions.readVerified(request);
    const userId = session?.verified === true ? session?.principal?.userId : null;
    if (typeof userId !== 'string' || !userId) return {status:401};
    // Authorization comes from Rivet's server-side membership, not from JWT user_metadata.
    const member = await members.forUser('rivet-auctions', userId);
    if (!member || member.active !== true || !OPERATORS.has(member.role))
      return {status:403};
    return {userId, role:member.role};
  }

  return async function fetchRivet(request) {
    try {
      const url = new URL(request.url);
      if (url.origin !== origin) return denied(403);
      const path = url.pathname;
      if (path !== '/team' && path !== '/api/team/requests') return json({error:'not_found'},404);
      if (request.method !== 'GET') return json({error:'method_not_allowed'},405);

      const actor = await authorize(request);
      if (actor.status) return denied(actor.status);

      if (path === '/team') {
        // Actual team UI is intentionally not migrated until session and DB are wired.
        return new Response('<!doctype html><meta charset="utf-8"><title>Rivet team</title><h1>Staff authorization passed</h1>', {
          status:200, headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8'}
        });
      }
      if (typeof cases?.listForStaff !== 'function') return json({error:'crm_not_configured'},503);
      const requests = await cases.listForStaff(actor.userId);
      return json({requests});
    } catch {
      // Fail closed and do not echo user details or database exceptions.
      return json({error:'request_not_completed'},503);
    }
  };
}
