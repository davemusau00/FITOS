CREATE TABLE IF NOT EXISTS platform_system_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'plan', 'tenant')),
  scope_value VARCHAR(160),
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT false,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_system_notices_scope_value_check CHECK (
    (scope = 'global' AND scope_value IS NULL) OR
    (scope IN ('plan', 'tenant') AND scope_value IS NOT NULL)
  ),
  CONSTRAINT platform_system_notices_schedule_check CHECK (
    expires_at IS NULL OR expires_at > starts_at
  )
);
CREATE INDEX IF NOT EXISTS idx_platform_notices_scope_schedule
  ON platform_system_notices(scope, scope_value, starts_at);
CREATE INDEX IF NOT EXISTS idx_platform_notices_expiry
  ON platform_system_notices(expires_at);

CREATE TABLE IF NOT EXISTS platform_notice_acknowledgements (
  notice_id UUID NOT NULL REFERENCES platform_system_notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);
