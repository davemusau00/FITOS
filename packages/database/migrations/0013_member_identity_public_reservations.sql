-- Production member credentials and unauthenticated reservation requests.
CREATE TABLE member_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, member_id)
);
CREATE TABLE member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_sessions_active ON member_sessions (tenant_id, member_id, expires_at) WHERE revoked_at IS NULL;
CREATE TABLE public_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  occurrence_id uuid REFERENCES schedule_occurrences(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  reservation_type varchar(40) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'requested',
  first_name varchar(120) NOT NULL,
  last_name varchar(120),
  phone varchar(60),
  email varchar(255),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reservation_type IN ('class','assessment','therapy','recovery','consultation','facility')),
  CHECK (status IN ('requested','confirmed','cancelled'))
);
CREATE INDEX idx_public_reservations_tenant_status ON public_reservations (tenant_id, branch_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION assert_member_identity_and_reservation_tenant() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME IN ('member_identities','member_sessions') AND NOT EXISTS (
    SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'member identity/session member must belong to tenant'; END IF;
  IF TG_TABLE_NAME = 'public_reservations' THEN
    IF NEW.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN RAISE EXCEPTION 'reservation branch must belong to tenant'; END IF;
    IF NEW.service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM services WHERE id = NEW.service_id AND tenant_id = NEW.tenant_id AND (NEW.branch_id IS NULL OR branch_id IS NULL OR branch_id = NEW.branch_id)) THEN RAISE EXCEPTION 'reservation service must belong to tenant and branch'; END IF;
    IF NEW.occurrence_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM schedule_occurrences WHERE id = NEW.occurrence_id AND tenant_id = NEW.tenant_id AND (NEW.branch_id IS NULL OR branch_id = NEW.branch_id)) THEN RAISE EXCEPTION 'reservation occurrence must belong to tenant and branch'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER member_identities_tenant_guard BEFORE INSERT OR UPDATE ON member_identities FOR EACH ROW EXECUTE FUNCTION assert_member_identity_and_reservation_tenant();
CREATE TRIGGER member_sessions_tenant_guard BEFORE INSERT OR UPDATE ON member_sessions FOR EACH ROW EXECUTE FUNCTION assert_member_identity_and_reservation_tenant();
CREATE TRIGGER public_reservations_tenant_guard BEFORE INSERT OR UPDATE ON public_reservations FOR EACH ROW EXECUTE FUNCTION assert_member_identity_and_reservation_tenant();
