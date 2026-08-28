CREATE TABLE IF NOT EXISTS platform_feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(80) NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'plan', 'tenant', 'pilot')),
  scope_value VARCHAR(160),
  enabled BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  previous_enabled BOOLEAN,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'global' AND scope_value IS NULL) OR (scope <> 'global' AND scope_value IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from)
);
CREATE INDEX IF NOT EXISTS idx_platform_flag_overrides_key_scope ON platform_feature_flag_overrides(key, scope, scope_value);
