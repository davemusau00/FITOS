ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL
  DEFAULT '{"email":true,"sms":false,"bookingReminders":true,"operationalAlerts":true,"leadFollowUps":true}'::jsonb;
