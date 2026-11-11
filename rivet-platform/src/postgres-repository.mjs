/**
 * Rivet-only database adapter. The connection must be server-side and may
 * query the private rivet schema. Never expose this pool or its password to
 * a browser. All writes happen in a single Postgres transaction.
 */
import {createHash, randomUUID} from 'node:crypto';

export class RivetIdempotencyConflict extends Error {
  constructor() { super('request_changed_use_new_id'); this.code = 'request_changed_use_new_id'; }
}

function requirePool(pool) {
  if (typeof pool?.connect !== 'function' || typeof pool?.query !== 'function')
    throw new TypeError('postgres_pool_required');
}
function asUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createRivetPostgresRepository({pool} = {}) {
  requirePool(pool);
  return {
    async saveInquiry(inquiry, requestKey) {
      if (!inquiry || !['seller','buyer'].includes(inquiry.kind) ||
          !/^[A-Za-z0-9_-]{20,100}$/.test(requestKey || ''))
        throw new TypeError('invalid_repository_request');
      const hash = createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
      const client = await pool.connect();
      let inTransaction = false;
      try {
        await client.query('BEGIN');
        inTransaction = true;
        // Serialize submissions with the same key, even across web processes.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [requestKey]);
        const existing = await client.query(
          'SELECT id, case_id, body_hash FROM rivet.inquiries WHERE request_key=$1 FOR UPDATE', [requestKey]
        );
        if (existing.rows.length) {
          if (existing.rows[0].body_hash.trim() !== hash)
            throw new RivetIdempotencyConflict();
          await client.query('COMMIT');
          inTransaction = false;
          return {id: existing.rows[0].id, caseId: existing.rows[0].case_id, replayed: true};
        }
        const contactId = randomUUID();
        const propertyId = inquiry.propertyAddress ? randomUUID() : null;
        const caseId = randomUUID();
        const inquiryId = randomUUID();
        await client.query(
          'INSERT INTO rivet.contacts (id, display_name, email, phone, preferred_reply) VALUES ($1,$2,$3,$4,$5)',
          [contactId, inquiry.name, inquiry.email || null, inquiry.phone || null, inquiry.preferredReply]
        );
        if (propertyId) await client.query(
          'INSERT INTO rivet.properties (id, submitted_address, city, state, postal_code, note, ownership_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [propertyId, inquiry.propertyAddress, inquiry.city || null, inquiry.state, inquiry.postalCode || null, inquiry.note || null, 'unverified']
        );
        await client.query(
          'INSERT INTO rivet.cases (id, contact_id, property_id, kind, source, stage, intake_note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [caseId, contactId, propertyId, inquiry.kind, inquiry.source, 'New', inquiry.note || null]
        );
        await client.query(
          'INSERT INTO rivet.inquiries (id, case_id, request_key, body_hash, reply_consent, consent_version) VALUES ($1,$2,$3,$4,$5,$6)',
          [inquiryId, caseId, requestKey, hash, inquiry.consentToReply, inquiry.consentVersion]
        );
        await client.query(
          'INSERT INTO rivet.tasks (id, case_id, action, status) VALUES ($1,$2,$3,$4)',
          [randomUUID(), caseId, 'Review new ' + inquiry.kind + ' inquiry', 'open']
        );
        await client.query(
          'INSERT INTO rivet.activities (id, case_id, kind, detail) VALUES ($1,$2,$3,$4)',
          [randomUUID(), caseId, 'inquiry_received', JSON.stringify({kind:inquiry.kind, source:inquiry.source})]
        );
        await client.query('COMMIT');
        inTransaction = false;
        return {id:inquiryId, caseId, replayed:false};
      } catch (error) {
        if (inTransaction) await client.query('ROLLBACK').catch(()=>{});
        throw error;
      } finally {
        client.release();
      }
    },
    async memberForUser(workspace, userId) {
      if (workspace !== 'rivet-auctions' || !asUuid(userId)) return null;
      const result = await pool.query(
        'SELECT active, role FROM rivet.staff_memberships WHERE workspace=$1 AND user_id=$2',
        [workspace, userId]
      );
      return result.rows[0] || null;
    },
    async listForStaff(userId) {
      if (!asUuid(userId)) return [];
      const result = await pool.query(
        'SELECT c.id, c.kind, c.stage, c.source, c.intake_note, c.created_at, ct.display_name AS name, ct.email, ct.phone, p.submitted_address AS property_address FROM rivet.cases c JOIN rivet.contacts ct ON ct.id=c.contact_id LEFT JOIN rivet.properties p ON p.id=c.property_id WHERE EXISTS (SELECT 1 FROM rivet.staff_memberships m WHERE m.workspace=$2 AND m.user_id=$1 AND m.active=true AND m.role IN (\'operator\',\'administrator\')) ORDER BY c.created_at DESC LIMIT 100',
        [userId, 'rivet-auctions']
      );
      return result.rows;
    }
  };
}
