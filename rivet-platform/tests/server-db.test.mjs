import test from 'node:test';
import assert from 'node:assert/strict';
import {createRivetDevelopmentPool, RIVET_DEVELOPMENT_PROJECT_REF} from '../src/server-db.mjs';

const certificate = '-----BEGIN CERTIFICATE-----\nfictional-fixture\n-----END CERTIFICATE-----';
const direct = 'postgresql://postgres:fictional-password@db.' + RIVET_DEVELOPMENT_PROJECT_REF + '.supabase.co:5432/postgres';
const pooled = 'postgresql://postgres.' + RIVET_DEVELOPMENT_PROJECT_REF + ':fictional-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

class FakePool { constructor(config) { this.config = config; } }

test('only the Rivet DEV database may be configured',()=>{
  assert.throws(()=>createRivetDevelopmentPool({Pool:FakePool,connectionString:direct.replace(RIVET_DEVELOPMENT_PROJECT_REF,'wrong-project'),caCertificate:certificate}),/wrong_rivet_database_project/);
  assert.throws(()=>createRivetDevelopmentPool({Pool:FakePool,connectionString:direct.replace('postgres:','postgresql-invalid:'),caCertificate:certificate}),/invalid_rivet_db_url/);
  assert.throws(()=>createRivetDevelopmentPool({Pool:FakePool,connectionString:direct}),/rivet_ca_certificate_required/);
  assert.throws(()=>createRivetDevelopmentPool({connectionString:direct,caCertificate:certificate}),/server_pg_pool_required/);
});
test('direct backend connection enforces full server certificate verification',()=>{
  const pool = createRivetDevelopmentPool({Pool:FakePool,connectionString:direct,caCertificate:certificate});
  assert.equal(pool.config.connectionString,direct);
  assert.equal(pool.config.ssl.rejectUnauthorized,true);
  assert.equal(pool.config.ssl.servername,'db.' + RIVET_DEVELOPMENT_PROJECT_REF + '.supabase.co');
  assert.equal(pool.config.ssl.ca,certificate);
  assert.equal(pool.config.max,1);
});
test('pooler is accepted only when username identifies the Rivet project',()=>{
  const accepted = createRivetDevelopmentPool({Pool:FakePool,connectionString:pooled,caCertificate:certificate});
  assert.equal(accepted.config.ssl.rejectUnauthorized,true);
  assert.throws(()=>createRivetDevelopmentPool({Pool:FakePool,connectionString:pooled.replace(RIVET_DEVELOPMENT_PROJECT_REF,'not-rivet'),caCertificate:certificate}),/wrong_rivet_database_project/);
});
test('SSL URL parameters cannot silently replace verified TLS settings',()=>{
  for (const option of ['sslmode=require','sslrootcert=/tmp/foo','sslcert=/tmp/foo','sslkey=/tmp/foo']) {
    assert.throws(()=>createRivetDevelopmentPool({Pool:FakePool,connectionString:direct+'?'+option,caCertificate:certificate}),/configure_tls_via_verified_pool_ca_only/);
  }
});
