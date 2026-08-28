ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_status_valid;
ALTER TABLE bookings ADD CONSTRAINT booking_status_valid CHECK (status IN ('confirmed', 'waitlisted', 'cancelled'));

DROP INDEX IF EXISTS uq_active_booking_member_occurrence;
CREATE UNIQUE INDEX uq_active_booking_member_occurrence
  ON bookings (tenant_id, occurrence_id, member_id)
  WHERE status IN ('confirmed', 'waitlisted');
