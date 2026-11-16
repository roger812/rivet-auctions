/**
 * Rivet-only, server-side PostgreSQL pool configuration for the DEV project.
 * This module has no side effects, no browser usage and no bundled secrets.
 * Supply the node-postgres Pool class from a trusted backend runtime.
 *
 * Not for production deployment; actual runtime/session/anti-bot gates are separate.
 */
export const RIVET_DEVELOPMENT_PROJECT_REF = 'kxcziyznpvbkgtgscdsd';

export function createRivetDevelopmentPool({Pool, connectionString, caCertificate} = {}) {
  if (typeof Pool !== 'function') throw new TypeError('server_pg_pool_required');
  if (typeof connectionString !== 'string' || !connectionString)
    throw new TypeError('rivet_db_url_required');

  let target;
  try { target = new URL(connectionString); }
  catch { throw new TypeError('invalid_rivet_db_url'); }

  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !target.password)
    throw new TypeError('invalid_rivet_db_url');

  const directHost = 'db.' + RIVET_DEVELOPMENT_PROJECT_REF + '.supabase.co';
  const direct = target.hostname === directHost && target.username === 'postgres';
  const pooled = target.hostname.endsWith('.pooler.supabase.com') &&
    target.username === 'postgres.' + RIVET_DEVELOPMENT_PROJECT_REF;

  if (!direct && !pooled) throw new TypeError('wrong_rivet_database_project');

  // node-postgres discards the separately provided SSL object if these URL
  // options are present. Reject that ambiguity rather than weakening TLS.
  for (const name of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    if (target.searchParams.has(name))
      throw new TypeError('configure_tls_via_verified_pool_ca_only');
  }

  if (typeof caCertificate !== 'string' ||
      !caCertificate.includes('-----BEGIN CERTIFICATE-----'))
    throw new TypeError('rivet_ca_certificate_required');

  // Intentionally small: controlled private proof, not a public web runtime.
  return new Pool({
    connectionString,
    ssl: { ca: caCertificate, rejectUnauthorized: true, servername: target.hostname },
    max: 1,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 1000
  });
}
