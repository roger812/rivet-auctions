# Rivet Auctions — independent secure platform (development only)

**Working branch:** `development/iwco-reuse-rivet-20261111`. **Live site not modified.**

This folder begins the Rivet Auctions implementation using patterns from the existing IWCO source repository. Its first check is a fail-closed server-side gate for `/team` and `/api/team/requests`. This is a standalone development module, **not a deployed CRM or production authentication solution**.

## Architecture source and boundaries

- Reference: `roger812/iwco-development`, `application/managed-auth/api.mjs` and supporting intake, session, membership and CRM modules, initially reviewed from `iwco/private-preview-cp11`.
- Separate brands: Rivet Auctions focuses on **real estate only**; preserve the already-approved bright, sunny, lead-capture design at `rivetauctions.com`. No fine-art copy and no public property listing catalog.
- Separate data: Rivet must have its **own database/project**, identities, membership roles, encryption keys, event logs, backups and consent records. Do not import IWCO homeowner leads or staff secrets.
- Seller flow: public landing page -> minimal inquiry -> validation/spam protection -> **Rivet-only** contact, property, case and first task -> private team queue.
- Buyer flow: buyer inquiry -> verified property/offer workflow -> explicit human review. Never accept a buyer-email price as a verified highest offer.
- Team desk: `/team` and **every** case/lead/staff API requires server-verified identity plus active Rivet membership. No client-side-only guards, no browser-provided role or email.
- Integration hooks: future Slack highest-offer update and email/Twilio must be authenticated, auditable, and idempotent. No external sending in this starter.

## Current implementation

`src/access-boundary.mjs` exposes `createRivetStaffBoundary`. It takes verified session and membership adapters and only serves two staff routes. It denies unknown, unverified and inactive users, and fails closed if the provider errors. **The adapters supplied in tests are fakes; production adapters do not yet exist.** The `/team` response is a placeholder, not the approved team UI. Public inquiry intake intentionally remains disabled until it has a persistence, rate-limit, consent and abuse-prevention implementation.

Run: `cd rivet-platform && npm test` (Node 22+; no external dependencies).

## Do-not-launch gates

1. Wire a real, signed, expiring, revocable session provider and server-side membership DAO.
2. Create an isolated Rivet Supabase project with private schema and RLS/grants reviewed. Keep service keys off public clients.
3. Port IWCO's intake and CRM models with Rivet-specific stages, consent, idempotency, audit history, and a durable transaction.
4. Implement responsive approved Rivet frontend and team desk, then test actual anonymous access over HTTP.
5. Verify staff logins, CSRF, rate limiting, record authorization, encrypted secrets, backups, email/Slack permissions, and legal disclosures.
6. Deploy to **a new Render preview hostname** first; do not change the DNS or ChatGPT Sites domain until the approved design and security are verified.
7. After cutover and rollback safety, archive older prototypes; delete only after explicit approval.

**No launch, live-site modification, actual lead migration, or IAM authorization is implied by this development branch.**
