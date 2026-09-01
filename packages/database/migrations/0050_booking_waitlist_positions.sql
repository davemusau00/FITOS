ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS waitlist_position integer;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, occurrence_id
      ORDER BY booked_at, id
    )::integer AS position
  FROM bookings
  WHERE status = 'waitlisted'
)
UPDATE bookings AS booking
SET waitlist_position = ranked.position
FROM ranked
WHERE booking.id = ranked.id;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS booking_waitlist_position_valid;
ALTER TABLE bookings
  ADD CONSTRAINT booking_waitlist_position_valid CHECK (
    (status = 'waitlisted' AND waitlist_position IS NOT NULL AND waitlist_position > 0)
    OR (status <> 'waitlisted' AND waitlist_position IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_bookings_waitlist_order
  ON bookings (tenant_id, occurrence_id, waitlist_position);
