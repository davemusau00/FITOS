-- ── Equipment & Resources ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(80) NOT NULL,
  category VARCHAR(80) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_pools_code ON equipment_pools (tenant_id, branch_id, code);
CREATE INDEX IF NOT EXISTS idx_equipment_pools_tenant_branch ON equipment_pools (tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS equipment_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  pool_id UUID REFERENCES equipment_pools(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  serial_number VARCHAR(120),
  model_number VARCHAR(120),
  category VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'operational',
  condition VARCHAR(40) NOT NULL DEFAULT 'good',
  hourly_operational_cost_minor INTEGER DEFAULT 0,
  purchase_date DATE,
  warranty_expires_at DATE,
  last_serviced_at TIMESTAMPTZ,
  next_service_due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_assets_tenant_branch ON equipment_assets (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assets_pool ON equipment_assets (tenant_id, pool_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assets_status ON equipment_assets (tenant_id, status);

CREATE TABLE IF NOT EXISTS equipment_maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  service_type VARCHAR(80) NOT NULL,
  cost_minor INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL,
  serviced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downtime_hours NUMERIC(6, 2),
  next_service_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_records_asset ON equipment_maintenance_records (tenant_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_maint_records_serviced_at ON equipment_maintenance_records (tenant_id, serviced_at);

CREATE TABLE IF NOT EXISTS service_equipment_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES equipment_pools(id) ON DELETE CASCADE,
  quantity_required INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_equipment_req ON service_equipment_requirements (tenant_id, service_id, pool_id);

CREATE TABLE IF NOT EXISTS occurrence_equipment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  occurrence_id UUID NOT NULL REFERENCES schedule_occurrences(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_occurrence_asset ON occurrence_equipment_allocations (tenant_id, occurrence_id, asset_id);

-- ─── Inventory & Consumables ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  sku VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  cost_price_minor INTEGER NOT NULL DEFAULT 0,
  retail_price_minor INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 5,
  reorder_quantity INTEGER NOT NULL DEFAULT 20,
  unit_of_measure VARCHAR(40) NOT NULL DEFAULT 'unit',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sku ON inventory_items (tenant_id, branch_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_branch ON inventory_items (tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason VARCHAR(255) NOT NULL,
  reference_id VARCHAR(120),
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_movements (tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_branch ON inventory_movements (tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  po_number VARCHAR(80) NOT NULL,
  supplier_name VARCHAR(160) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  total_amount_minor INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_po_number ON purchase_orders (tenant_id, branch_id, po_number);

-- ─── FITOS Assess & Diagnostics ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessment_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  device_vendor VARCHAR(80) NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_def_code ON assessment_definitions (tenant_id, code);

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assessor_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  definition_id UUID NOT NULL REFERENCES assessment_definitions(id) ON DELETE RESTRICT,
  category VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'completed',
  conducted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance_json JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assess_sessions_member ON assessment_sessions (tenant_id, member_id);
CREATE INDEX IF NOT EXISTS idx_assess_sessions_conducted_at ON assessment_sessions (tenant_id, conducted_at);

CREATE TABLE IF NOT EXISTS assessment_device_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  device_vendor VARCHAR(80) NOT NULL,
  device_serial VARCHAR(120),
  file_name VARCHAR(255),
  raw_checksum VARCHAR(64) NOT NULL,
  raw_payload TEXT NOT NULL,
  parsed_records_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'processed',
  imported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_imports_tenant_branch ON assessment_device_imports (tenant_id, branch_id);

-- ─── FITOS Therapy & Recovery ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapy_modalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  default_duration_minutes INTEGER NOT NULL DEFAULT 30,
  contraindications_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_therapy_modality_code ON therapy_modalities (tenant_id, code);

CREATE TABLE IF NOT EXISTS therapy_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  modality_code VARCHAR(80) NOT NULL,
  modality_name VARCHAR(160) NOT NULL,
  name VARCHAR(160) NOT NULL,
  indication VARCHAR(255) NOT NULL,
  target_area VARCHAR(160) NOT NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinical_notes TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapy_protocols_modality ON therapy_protocols (tenant_id, modality_code);

CREATE TABLE IF NOT EXISTS therapy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  staff_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  protocol_id UUID NOT NULL REFERENCES therapy_protocols(id) ON DELETE RESTRICT,
  protocol_name VARCHAR(160) NOT NULL,
  modality_code VARCHAR(80) NOT NULL,
  asset_id UUID REFERENCES equipment_assets(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'completed',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  pre_pain_score INTEGER,
  post_pain_score INTEGER,
  actual_dosage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  adverse_reaction BOOLEAN NOT NULL DEFAULT FALSE,
  session_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_member ON therapy_sessions (tenant_id, member_id);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_started_at ON therapy_sessions (tenant_id, started_at);
