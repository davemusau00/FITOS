CREATE TABLE implementation_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(40) NOT NULL DEFAULT 'draft',
  contact_name varchar(160),
  business_name varchar(160),
  email varchar(255),
  phone varchar(60),
  country varchar(80),
  business_type varchar(80),
  submitted_at timestamptz,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  converted_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft','submitted','qualified','needs_clarification','approved','converted','archived'))
);
CREATE TABLE implementation_inquiry_payloads (
  inquiry_id uuid PRIMARY KEY REFERENCES implementation_inquiries(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE implementation_inquiry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES implementation_inquiries(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(80) NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_implementation_inquiries_status_created ON implementation_inquiries(status, created_at DESC);
CREATE INDEX idx_implementation_inquiry_events_inquiry ON implementation_inquiry_events(inquiry_id, created_at DESC);
