-- Distinguish reservations made via the public website from ones an admin
-- creates directly for a walk-in customer at the office.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';

ALTER TABLE reservations
  ADD CONSTRAINT reservations_source_check CHECK (source IN ('online', 'walk_in'));