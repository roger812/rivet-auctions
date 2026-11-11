-- Rivet Auctions proposed isolated Supabase PostgreSQL schema.
-- DEVELOPMENT ONLY: not executed against any live database.
-- Install only in the separate Rivet project using a migration owner.
-- The public website never connects to these tables directly.

CREATE SCHEMA rivet;
REVOKE ALL ON SCHEMA rivet FROM PUBLIC, anon, authenticated;

CREATE TABLE rivet.staff_memberships (
  workspace text NOT NULL DEFAULT 'rivet-auctions' CHECK (workspace='rivet-auctions'),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('administrator','operator','support','oversight')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace,user_id)
);

CREATE TABLE rivet.contacts (
  id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  email text,
  phone text,
  preferred_reply text NOT NULL CHECK (preferred_reply IN ('email','call','text')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE rivet.properties (
  id uuid PRIMARY KEY,
  submitted_address text NOT NULL,
  city text,
  state text NOT NULL DEFAULT 'TX' CHECK (state='TX'),
  postal_code text,
  note text,
  ownership_status text NOT NULL DEFAULT 'unverified' CHECK (ownership_status IN ('unverified','verified')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rivet.cases (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES rivet.contacts(id),
  property_id uuid REFERENCES rivet.properties(id),
  kind text NOT NULL CHECK (kind IN ('seller','buyer')),
  source text NOT NULL,
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New','Reviewing','Contacted','Qualified','Under contract','Closed')),
  owner_user_id uuid,
  owner_workspace text NOT NULL DEFAULT 'rivet-auctions' CHECK (owner_workspace='rivet-auctions'),
  intake_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_workspace,owner_user_id) REFERENCES rivet.staff_memberships(workspace,user_id)
);

CREATE TABLE rivet.inquiries (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES rivet.cases(id),
  request_key text NOT NULL UNIQUE CHECK (char_length(request_key) BETWEEN 20 AND 100),
  body_hash char(64) NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  reply_consent boolean NOT NULL CHECK (reply_consent=true),
  consent_version text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rivet.tasks (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES rivet.cases(id),
  action text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rivet.activities (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES rivet.cases(id),
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cases_stage_updated ON rivet.cases (stage,updated_at DESC);
CREATE INDEX cases_contact_id ON rivet.cases (contact_id);
CREATE INDEX cases_property_id ON rivet.cases (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX tasks_case_status ON rivet.tasks (case_id,status);
CREATE INDEX activities_case_created ON rivet.activities (case_id,created_at DESC);
CREATE INDEX inquiries_case_id ON rivet.inquiries (case_id);

-- Defense in depth. No anon or authenticated grant and no permissive RLS policies.
ALTER TABLE rivet.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivet.activities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA rivet FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA rivet TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA rivet TO service_role;
GRANT INSERT ON rivet.contacts,rivet.properties,rivet.cases,rivet.inquiries,rivet.tasks,rivet.activities TO service_role;
GRANT UPDATE ON rivet.cases,rivet.tasks TO service_role;

-- Do not expose the rivet schema via Supabase Data API.
-- Server-side staff identity and Rivet membership must both be checked.
-- No policies are created for anon/authenticated: their access is denied.
