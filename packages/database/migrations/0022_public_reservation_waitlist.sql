ALTER TABLE public_reservations DROP CONSTRAINT IF EXISTS public_reservations_status_check;
ALTER TABLE public_reservations ADD CONSTRAINT public_reservations_status_check CHECK (status IN ('requested', 'confirmed', 'waitlisted', 'cancelled'));
