/**
 * Rivet HTTP composition candidate. No provider is silently optional.
 * The public intake and the private team routes remain independent.
 * This is not the deployed ChatGPT Sites runtime.
 */
import {createRivetPublicIntake} from './public-intake.mjs';
import {createRivetStaffBoundary} from './access-boundary.mjs';

const simple = (status, error) => new Response(JSON.stringify({error}), {
  status, headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});

export function createRivetApplication({origin, sessions, members, cases, repository, verifyHuman, rateLimiter}={}) {
  const team = createRivetStaffBoundary({origin,sessions,members,cases});
  const intake = createRivetPublicIntake({origin,repository,verifyHuman,rateLimiter});
  return async request => {
    try {
      const url = new URL(request.url);
      if (url.origin !== origin) return simple(403, 'origin_not_allowed');
      if (url.pathname === '/healthz' && request.method === 'GET')
        return new Response('ok', {status:200,headers:{'Cache-Control':'no-store','Content-Type':'text/plain'}});
      if (url.pathname === '/team' || url.pathname === '/api/team/requests')
        return team(request);
      if (url.pathname === '/api/inquiries') return intake(request);
      return simple(404, 'not_found');
    } catch {
      return simple(503, 'request_not_completed');
    }
  };
}
