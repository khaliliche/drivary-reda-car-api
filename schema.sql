-- Full schema for Drivary Reda Car — fresh database, no legacy data to preserve.

DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS login_attempts;
DROP SEQUENCE IF EXISTS contract_number_seq;

-- Contract numbers continue the client's paper booklet.
CREATE SEQUENCE contract_number_seq START WITH 501;

CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  price_per_day INTEGER NOT NULL,
  min_rental_days INTEGER NOT NULL DEFAULT 5,
  price_extended_15 NUMERIC NOT NULL,
  price_monthly_30 NUMERIC NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walk_in')),

  -- Driver (main)
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  cin_number TEXT NOT NULL,
  cin_delivered_le DATE,
  license_issue_date DATE NOT NULL,
  driver_address TEXT NOT NULL DEFAULT '',
  driver_phone TEXT NOT NULL DEFAULT '',
  driver_license_number TEXT NOT NULL DEFAULT '',
  driver_passport_number TEXT NOT NULL DEFAULT '',
  passport_delivered_le DATE,

  -- Second driver (optional block)
  has_second_driver BOOLEAN NOT NULL DEFAULT false,
  second_driver_prenom TEXT NOT NULL DEFAULT '',
  second_driver_nom TEXT NOT NULL DEFAULT '',
  second_driver_date_naissance DATE,
  second_driver_address TEXT NOT NULL DEFAULT '',
  second_driver_phone TEXT NOT NULL DEFAULT '',
  second_driver_cin_number TEXT NOT NULL DEFAULT '',
  second_driver_cin_delivered_le DATE,
  second_driver_license_number TEXT NOT NULL DEFAULT '',
  second_driver_passport_number TEXT NOT NULL DEFAULT '',
  second_driver_passport_delivered_le DATE,

  -- Rental period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '10:00',
  lieu_livraison_depart TEXT NOT NULL DEFAULT '',
  lieu_livraison_retour TEXT NOT NULL DEFAULT '',
  retour_prevu_le TIMESTAMPTZ,
  prolongation TEXT NOT NULL DEFAULT '',

  -- Admin handover completion
  registration_plate TEXT NOT NULL DEFAULT '',
  mileage_start INTEGER,
  mileage_end INTEGER,
  damages JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '{}'::jsonb,
  fuel_type TEXT NOT NULL DEFAULT '',
  fuel_level_out NUMERIC,
  fuel_level_in NUMERIC,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  pickup_fee NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Admin contract editing / billing — TTC only, no TVA
  fait_a TEXT NOT NULL DEFAULT '',
  override_total_ttc NUMERIC(10,2),
  avance NUMERIC(10,2) NOT NULL DEFAULT 0,
  reste_a_payer NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Contract identity
  contract_number TEXT UNIQUE,
  contract_generated_at TIMESTAMPTZ,

  -- Remote signing (main driver)
  signing_token UUID UNIQUE,
  signing_token_expires_at TIMESTAMPTZ,
  signer_name TEXT,
  signed_at TIMESTAMPTZ,
  signer_ip TEXT,
  signature_data TEXT,

  -- Remote signing (second driver) — fully independent slot
  signing_token_2 UUID UNIQUE,
  signing_token_2_expires_at TIMESTAMPTZ,
  signer_2_name TEXT,
  signed_2_at TIMESTAMPTZ,
  signer_2_ip TEXT,
  signature_2_data TEXT,

  -- Admin/company countersignature — captured in-app, above the stamp on the PDF
  admin_signature_data TEXT,
  admin_signed_at TIMESTAMPTZ,
  admin_signer_name TEXT,

  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_vehicle_status_dates
  ON reservations (vehicle_id, status, start_date, end_date);

CREATE INDEX idx_reservations_signing_token
  ON reservations (signing_token);

CREATE INDEX idx_reservations_signing_token_2
  ON reservations (signing_token_2);

-- Persistent per-IP failure counter with a ban timestamp (survives redeploys).
CREATE TABLE login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);
