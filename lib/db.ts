import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { getTieredPricing } from "./pricing";

export const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

export type Vehicle = {
  id: number;
  slug: string;
  brand: string;
  model: string;
  price_per_day: number;
  price_extended_15: number;
  price_monthly_30: number;
  min_rental_days: number;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export type ReservationStatus = "pending" | "contacted" | "confirmed" | "cancelled";
export type ReservationSource = "online" | "walk_in";

export type DamageEntry = {
  zone: string;
  type: string;
  note: string;
};

export type EquipmentChecklist = Record<string, boolean>;

export type Reservation = {
  id: number;
  vehicle_id: number | null;
  vehicle_label: string;

  prenom: string;
  nom: string;
  date_naissance: string;
  cin_number: string;
  cin_delivered_le: string | null;
  license_issue_date: string;
  driver_address: string;
  driver_phone: string;
  driver_license_number: string;
  driver_passport_number: string;
  passport_delivered_le: string | null;

  has_second_driver: boolean;
  second_driver_prenom: string;
  second_driver_nom: string;
  second_driver_date_naissance: string | null;
  second_driver_address: string;
  second_driver_phone: string;
  second_driver_cin_number: string;
  second_driver_cin_delivered_le: string | null;
  second_driver_license_number: string;
  second_driver_passport_number: string;
  second_driver_passport_delivered_le: string | null;

  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  lieu_livraison_depart: string;
  lieu_livraison_retour: string;
  retour_prevu_le: string | null;
  prolongation: string;

  registration_plate: string;
  mileage_start: number | null;
  mileage_end: number | null;
  damages: DamageEntry[];
  equipment: EquipmentChecklist;
  fuel_type: string;
  fuel_level_out: number | null;
  fuel_level_in: number | null;
  delivery_fee: number;
  pickup_fee: number;

  fait_a: string;
  override_total_ttc: number | null;
  avance: number;
  reste_a_payer: number;

  contract_number: string | null;
  contract_generated_at: string | null;

  signing_token: string | null;
  signing_token_expires_at: string | null;
  signer_name: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signature_data: string | null;

  signing_token_2: string | null;
  signing_token_2_expires_at: string | null;
  signer_2_name: string | null;
  signed_2_at: string | null;
  signer_2_ip: string | null;
  signature_2_data: string | null;

  admin_signature_data: string | null;
  admin_signed_at: string | null;
  admin_signer_name: string | null;

  source: ReservationSource;
  status: ReservationStatus;
  created_at: string;
};

function slugify(brand: string, model: string) {
  return `${brand}-${model}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string, excludeId?: number) {
  let slug = base;
  let i = 2;
  while (true) {
    const rows = excludeId
      ? await sql`SELECT id FROM vehicles WHERE slug = ${slug} AND id != ${excludeId}`
      : await sql`SELECT id FROM vehicles WHERE slug = ${slug}`;
    if (rows.length === 0) return slug;
    slug = `${base}-${i}`;
    i++;
  }
}

export async function getVehicles(): Promise<Vehicle[]> {
  const rows = await sql<Vehicle[]>`SELECT * FROM vehicles ORDER BY created_at DESC`;
  return rows;
}

export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const rows = await sql<Vehicle[]>`SELECT * FROM vehicles WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const rows = await sql<Vehicle[]>`SELECT * FROM vehicles WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createVehicle(data: {
  brand: string;
  model: string;
  price_per_day: number;
  description: string;
  image_url: string;
}) {
  const slug = await uniqueSlug(slugify(data.brand, data.model));
  const { price_extended_15, price_monthly_30 } = getTieredPricing(data.price_per_day);
  const rows = await sql<Vehicle[]>`
    INSERT INTO vehicles (slug, brand, model, price_per_day, price_extended_15, price_monthly_30, description, image_url)
    VALUES (${slug}, ${data.brand}, ${data.model}, ${data.price_per_day}, ${price_extended_15}, ${price_monthly_30}, ${data.description}, ${data.image_url})
    RETURNING *
  `;
  return rows[0];
}

export async function updateVehicle(
  id: number,
  data: { brand: string; model: string; price_per_day: number; description: string; image_url: string }
) {
  const base = slugify(data.brand, data.model);
  const slug = await uniqueSlug(base, id);
  const { price_extended_15, price_monthly_30 } = getTieredPricing(data.price_per_day);
  const rows = await sql<Vehicle[]>`
    UPDATE vehicles
    SET slug = ${slug}, brand = ${data.brand}, model = ${data.model},
        price_per_day = ${data.price_per_day}, price_extended_15 = ${price_extended_15},
        price_monthly_30 = ${price_monthly_30}, description = ${data.description},
        image_url = ${data.image_url}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function deleteVehicle(id: number) {
  await sql`DELETE FROM vehicles WHERE id = ${id}`;
}

export type CreateReservationInput = {
  vehicle_id: number;
  vehicle_label: string;

  prenom: string;
  nom: string;
  date_naissance: string;
  cin_number: string;
  license_issue_date: string;
  driver_address: string;
  driver_phone: string;
  driver_license_number: string;
  driver_passport_number: string;

  has_second_driver: boolean;
  second_driver_prenom?: string;
  second_driver_nom?: string;
  second_driver_address?: string;
  second_driver_phone?: string;
  second_driver_cin_number?: string;
  second_driver_license_number?: string;
  second_driver_passport_number?: string;

  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
};

export async function createReservation(
  data: CreateReservationInput
): Promise<Reservation> {
  const rows = await sql<Reservation[]>`
    INSERT INTO reservations
      (vehicle_id, vehicle_label,
       prenom, nom, date_naissance, cin_number, license_issue_date,
       driver_address, driver_phone, driver_license_number, driver_passport_number,
       has_second_driver,
       second_driver_prenom, second_driver_nom, second_driver_address, second_driver_phone,
       second_driver_cin_number, second_driver_license_number, second_driver_passport_number,
       start_date, end_date, start_time, end_time)
    VALUES
      (${data.vehicle_id}, ${data.vehicle_label},
       ${data.prenom}, ${data.nom}, ${data.date_naissance}, ${data.cin_number}, ${data.license_issue_date},
       ${data.driver_address}, ${data.driver_phone}, ${data.driver_license_number}, ${data.driver_passport_number},
       ${data.has_second_driver},
       ${data.second_driver_prenom ?? ""}, ${data.second_driver_nom ?? ""}, ${data.second_driver_address ?? ""}, ${data.second_driver_phone ?? ""},
       ${data.second_driver_cin_number ?? ""}, ${data.second_driver_license_number ?? ""}, ${data.second_driver_passport_number ?? ""},
       ${data.start_date}, ${data.end_date}, ${data.start_time}, ${data.end_time})
    RETURNING *
  `;
  return rows[0];
}

export type CreateWalkInReservationInput = CreateReservationInput & {
  fait_a?: string;
};

export async function createWalkInReservation(
  data: CreateWalkInReservationInput
): Promise<{ ok: true; reservation: Reservation } | { ok: false; reason: "conflict" }> {
  const available = await isVehicleAvailable(data.vehicle_id, data.start_date, data.end_date);
  if (!available) {
    return { ok: false, reason: "conflict" };
  }

  const rows = await sql<Reservation[]>`
    INSERT INTO reservations
      (vehicle_id, vehicle_label,
       prenom, nom, date_naissance, cin_number, license_issue_date,
       driver_address, driver_phone, driver_license_number, driver_passport_number,
       has_second_driver,
       second_driver_prenom, second_driver_nom, second_driver_address, second_driver_phone,
       second_driver_cin_number, second_driver_license_number, second_driver_passport_number,
       start_date, end_date, start_time, end_time,
       fait_a, source, status,
       contract_number, contract_generated_at)
    VALUES
      (${data.vehicle_id}, ${data.vehicle_label},
       ${data.prenom}, ${data.nom}, ${data.date_naissance}, ${data.cin_number}, ${data.license_issue_date},
       ${data.driver_address}, ${data.driver_phone}, ${data.driver_license_number}, ${data.driver_passport_number},
       ${data.has_second_driver},
       ${data.second_driver_prenom ?? ""}, ${data.second_driver_nom ?? ""}, ${data.second_driver_address ?? ""}, ${data.second_driver_phone ?? ""},
       ${data.second_driver_cin_number ?? ""}, ${data.second_driver_license_number ?? ""}, ${data.second_driver_passport_number ?? ""},
       ${data.start_date}, ${data.end_date}, ${data.start_time}, ${data.end_time},
       ${data.fait_a ?? ""}, 'walk_in', 'confirmed',
       lpad(nextval('contract_number_seq')::text, 7, '0'), now())
    RETURNING *
  `;
  return { ok: true, reservation: rows[0] };
}

export async function getReservations(): Promise<Reservation[]> {
  const rows = await sql<Reservation[]>`SELECT * FROM reservations ORDER BY created_at DESC`;
  return rows;
}

export async function getReservationById(id: number): Promise<Reservation | null> {
  const rows = await sql<Reservation[]>`SELECT * FROM reservations WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function updateReservationStatus(id: number, status: ReservationStatus) {
  await sql`UPDATE reservations SET status = ${status} WHERE id = ${id}`;
}

export async function isVehicleAvailable(
  vehicleId: number,
  startDate: string,
  endDate: string,
  excludeReservationId?: number
): Promise<boolean> {
  const rows = excludeReservationId
    ? await sql`
        SELECT id FROM reservations
        WHERE vehicle_id = ${vehicleId}
          AND status = 'confirmed'
          AND id != ${excludeReservationId}
          AND start_date <= ${endDate}
          AND end_date >= ${startDate}
        LIMIT 1
      `
    : await sql`
        SELECT id FROM reservations
        WHERE vehicle_id = ${vehicleId}
          AND status = 'confirmed'
          AND start_date <= ${endDate}
          AND end_date >= ${startDate}
        LIMIT 1
      `;
  return rows.length === 0;
}

export async function getAvailableVehicles(
  startDate?: string,
  endDate?: string
): Promise<Vehicle[]> {
  const vehicles = await getVehicles();
  if (!startDate || !endDate) return vehicles;

  const rows = await sql<{ vehicle_id: number | null }[]>`
    SELECT DISTINCT vehicle_id FROM reservations
    WHERE status = 'confirmed'
      AND start_date <= ${endDate}
      AND end_date >= ${startDate}
  `;
  const bookedIds = new Set(rows.map((r) => r.vehicle_id));
  return vehicles.filter((v) => !bookedIds.has(v.id));
}

export async function confirmReservation(
  id: number
): Promise<{ ok: true } | { ok: false; reason: "conflict" | "notFound" }> {
  const reservation = await getReservationById(id);
  if (!reservation || !reservation.vehicle_id) {
    return { ok: false, reason: "notFound" };
  }

  const available = await isVehicleAvailable(
    reservation.vehicle_id,
    reservation.start_date,
    reservation.end_date,
    reservation.id
  );
  if (!available) {
    return { ok: false, reason: "conflict" };
  }

  await sql`
    UPDATE reservations
    SET status = 'confirmed',
        contract_number = COALESCE(
          contract_number,
          lpad(nextval('contract_number_seq')::text, 7, '0')
        ),
        contract_generated_at = COALESCE(contract_generated_at, now())
    WHERE id = ${id}
  `;
  return { ok: true };
}

export async function updateReservationHandover(
  id: number,
  data: {
    registration_plate: string;
    mileage_start: number | null;
    mileage_end: number | null;
    damages: DamageEntry[];
    equipment: EquipmentChecklist;
    fuel_type: string;
    fuel_level_out: number | null;
    fuel_level_in: number | null;
    delivery_fee: number;
    pickup_fee: number;
  }
): Promise<Reservation> {
  const rows = await sql<Reservation[]>`
    UPDATE reservations
    SET registration_plate = ${data.registration_plate},
        mileage_start = ${data.mileage_start},
        mileage_end = ${data.mileage_end},
        damages = ${sql.json(data.damages)},
        equipment = ${sql.json(data.equipment)},
        fuel_type = ${data.fuel_type},
        fuel_level_out = ${data.fuel_level_out},
        fuel_level_in = ${data.fuel_level_in},
        delivery_fee = ${data.delivery_fee},
        pickup_fee = ${data.pickup_fee}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function deleteReservation(id: number) {
  await sql`DELETE FROM reservations WHERE id = ${id}`;
}

export type UpdateReservationContractInput = {
  prenom: string;
  nom: string;
  date_naissance: string;
  cin_number: string;
  cin_delivered_le: string | null;
  license_issue_date: string;
  driver_address: string;
  driver_phone: string;
  driver_license_number: string;
  driver_passport_number: string;
  passport_delivered_le: string | null;

  has_second_driver: boolean;
  second_driver_prenom: string;
  second_driver_nom: string;
  second_driver_date_naissance: string | null;
  second_driver_address: string;
  second_driver_phone: string;
  second_driver_cin_number: string;
  second_driver_cin_delivered_le: string | null;
  second_driver_license_number: string;
  second_driver_passport_number: string;
  second_driver_passport_delivered_le: string | null;

  vehicle_label: string;
  registration_plate: string;

  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  lieu_livraison_depart: string;
  lieu_livraison_retour: string;
  retour_prevu_le: string | null;
  prolongation: string;

  mileage_start: number | null;
  mileage_end: number | null;
  damages: DamageEntry[];
  equipment: EquipmentChecklist;
  fuel_type: string;
  fuel_level_out: number | null;
  fuel_level_in: number | null;
  delivery_fee: number;
  pickup_fee: number;

  fait_a: string;
  override_total_ttc: number | null;
  avance: number;
  reste_a_payer: number;
};

export async function updateReservationContract(
  id: number,
  data: UpdateReservationContractInput
): Promise<Reservation> {
  const rows = await sql<Reservation[]>`
    UPDATE reservations
    SET prenom = ${data.prenom},
        nom = ${data.nom},
        date_naissance = ${data.date_naissance},
        cin_number = ${data.cin_number},
        cin_delivered_le = ${data.cin_delivered_le},
        license_issue_date = ${data.license_issue_date},
        driver_address = ${data.driver_address},
        driver_phone = ${data.driver_phone},
        driver_license_number = ${data.driver_license_number},
        driver_passport_number = ${data.driver_passport_number},
        passport_delivered_le = ${data.passport_delivered_le},

        has_second_driver = ${data.has_second_driver},
        second_driver_prenom = ${data.second_driver_prenom},
        second_driver_nom = ${data.second_driver_nom},
        second_driver_date_naissance = ${data.second_driver_date_naissance},
        second_driver_address = ${data.second_driver_address},
        second_driver_phone = ${data.second_driver_phone},
        second_driver_cin_number = ${data.second_driver_cin_number},
        second_driver_cin_delivered_le = ${data.second_driver_cin_delivered_le},
        second_driver_license_number = ${data.second_driver_license_number},
        second_driver_passport_number = ${data.second_driver_passport_number},
        second_driver_passport_delivered_le = ${data.second_driver_passport_delivered_le},

        vehicle_label = ${data.vehicle_label},
        registration_plate = ${data.registration_plate},

        start_date = ${data.start_date},
        end_date = ${data.end_date},
        start_time = ${data.start_time},
        end_time = ${data.end_time},
        lieu_livraison_depart = ${data.lieu_livraison_depart},
        lieu_livraison_retour = ${data.lieu_livraison_retour},
        retour_prevu_le = ${data.retour_prevu_le},
        prolongation = ${data.prolongation},

        mileage_start = ${data.mileage_start},
        mileage_end = ${data.mileage_end},
        damages = ${sql.json(data.damages)},
        equipment = ${sql.json(data.equipment)},
        fuel_type = ${data.fuel_type},
        fuel_level_out = ${data.fuel_level_out},
        fuel_level_in = ${data.fuel_level_in},
        delivery_fee = ${data.delivery_fee},
        pickup_fee = ${data.pickup_fee},

        fait_a = ${data.fait_a},
        override_total_ttc = ${data.override_total_ttc},
        avance = ${data.avance},
        reste_a_payer = ${data.reste_a_payer}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function recordAdminSignature(
  id: number,
  data: { admin_signer_name: string; admin_signature_data: string }
): Promise<Reservation> {
  const rows = await sql<Reservation[]>`
    UPDATE reservations
    SET admin_signer_name = ${data.admin_signer_name},
        admin_signature_data = ${data.admin_signature_data},
        admin_signed_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function createSigningToken(id: number): Promise<string | null> {
  const token = randomUUID();
  const rows = await sql<{ signing_token: string }[]>`
    UPDATE reservations
    SET signing_token = ${token},
        signing_token_expires_at = now() + interval '7 days'
    WHERE id = ${id}
    RETURNING signing_token
  `;
  return rows[0]?.signing_token ?? null;
}

export async function getReservationBySigningToken(token: string): Promise<Reservation | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }
  const rows = await sql<Reservation[]>`
    SELECT * FROM reservations
    WHERE signing_token = ${token} OR signing_token_2 = ${token}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function isSecondDriverToken(reservation: Reservation, token: string): boolean {
  return reservation.signing_token_2 === token;
}

export async function consumeSigningToken(
  token: string,
  data: { signer_name: string; signer_ip: string; signature_data: string }
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE reservations
    SET signer_name = ${data.signer_name},
        signer_ip = ${data.signer_ip},
        signature_data = ${data.signature_data},
        signed_at = now(),
        signing_token = NULL,
        signing_token_expires_at = NULL
    WHERE signing_token = ${token}
      AND signed_at IS NULL
      AND status != 'cancelled'
      AND (signing_token_expires_at IS NULL OR signing_token_expires_at > now())
    RETURNING id
  `;
  return rows.length === 1;
}

export async function createSigningToken2(id: number): Promise<string | null> {
  const token = randomUUID();
  const rows = await sql<{ signing_token_2: string }[]>`
    UPDATE reservations
    SET signing_token_2 = ${token},
        signing_token_2_expires_at = now() + interval '7 days'
    WHERE id = ${id} AND has_second_driver = true
    RETURNING signing_token_2
  `;
  return rows[0]?.signing_token_2 ?? null;
}

export async function consumeSigningToken2(
  token: string,
  data: { signer_name: string; signer_ip: string; signature_data: string }
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE reservations
    SET signer_2_name = ${data.signer_name},
        signer_2_ip = ${data.signer_ip},
        signature_2_data = ${data.signature_data},
        signed_2_at = now(),
        signing_token_2 = NULL,
        signing_token_2_expires_at = NULL
    WHERE signing_token_2 = ${token}
      AND signed_2_at IS NULL
      AND status != 'cancelled'
      AND (signing_token_2_expires_at IS NULL OR signing_token_2_expires_at > now())
    RETURNING id
  `;
  return rows.length === 1;
}

export async function getLockExpiry(key: string): Promise<Date | null> {
  const rows = await sql<{ locked_until: Date }[]>`
    SELECT locked_until FROM login_attempts
    WHERE ip = ${key} AND locked_until > now()
    LIMIT 1
  `;
  return rows[0]?.locked_until ?? null;
}

async function isKeyActive(key: string): Promise<boolean> {
  const rows = await sql<{ active: boolean }[]>`
    SELECT (locked_until IS NULL OR locked_until <= now()) AS active
    FROM login_attempts WHERE ip = ${key}
  `;
  return rows[0]?.active ?? true;
}

export async function recordFailedAttempt(
  key: string,
  opts: { maxAttempts: number; banMs: number }
): Promise<void> {
  const { maxAttempts, banMs } = opts;
  if (!(await isKeyActive(key))) return;

  await sql`
    INSERT INTO login_attempts (ip, count)
    VALUES (${key}, 1)
    ON CONFLICT (ip) DO UPDATE SET count = login_attempts.count + 1
  `;

  await sql`
    UPDATE login_attempts
    SET count = 0,
        locked_until = now() + make_interval(secs => ${Math.floor(banMs / 1000)})
    WHERE ip = ${key} AND count >= ${maxAttempts}
  `;
}

export async function clearFailures(key: string): Promise<void> {
  await sql`DELETE FROM login_attempts WHERE ip = ${key}`;
}

export async function consumeWindowedLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const rows = await sql<{ count: number }[]>`
    INSERT INTO login_attempts (ip, count, locked_until)
    VALUES (${key}, 1, now() + make_interval(secs => ${Math.floor(windowMs / 1000)}))
    ON CONFLICT (ip) DO UPDATE SET
      locked_until = CASE
        WHEN login_attempts.locked_until IS NULL OR login_attempts.locked_until <= now()
          THEN now() + make_interval(secs => ${Math.floor(windowMs / 1000)})
        ELSE login_attempts.locked_until
      END,
      count = CASE
        WHEN login_attempts.locked_until IS NULL OR login_attempts.locked_until <= now()
          THEN 1
        WHEN login_attempts.count > ${max}
          THEN login_attempts.count
        ELSE login_attempts.count + 1
      END
    RETURNING count
  `;
  return rows[0] ? rows[0].count <= max : false;
}
