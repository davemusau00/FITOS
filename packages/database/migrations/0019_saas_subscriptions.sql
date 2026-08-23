CREATE TABLE tenant_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan varchar(30) NOT NULL DEFAULT 'pro', status varchar(30) NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz, current_period_ends_at timestamptz, capabilities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (plan IN ('starter','pro','business')),
  CHECK (status IN ('trial','active','grace','suspended','cancelled','archived'))
);
