ALTER TABLE services
  ADD COLUMN IF NOT EXISTS booking_window_hours integer;

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_booking_window_hours_check;

ALTER TABLE services
  ADD CONSTRAINT services_booking_window_hours_check
  CHECK (booking_window_hours IS NULL OR booking_window_hours >= 0);
