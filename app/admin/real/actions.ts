
"use server";

import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase";

import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateReservationStatus,
  deleteReservation,
  confirmReservation,
  createSigningToken,
  createSigningToken2,
  updateReservationHandover,
  updateReservationContract,
  recordAdminSignature,
  getReservationById,
  getVehicleById,
  createWalkInReservation,
  type ReservationStatus,
  type DamageEntry,
  type EquipmentChecklist,
} from "@/lib/db";

import {
  checkPassword,
  getExpectedSessionToken,
  getClientIp,
  checkFailureLimit,
  recordFailure,
  resetFailures,
  timingSafeEqual,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_BAN_MS,
} from "@/lib/auth";

import { EQUIPMENT_ITEMS } from "@/lib/contract";

/* -------------------------------------------------------------------------- */
/* ADMIN AUTH                                                                 */
/* -------------------------------------------------------------------------- */

async function requireAdmin() {
  const expectedToken = await getExpectedSessionToken();

  const store = await cookies();
  const cookie = store.get("admin_session")?.value;

  if (
    !expectedToken ||
    !cookie ||
    !timingSafeEqual(cookie, expectedToken)
  ) {
    redirect("/admin/real/login");
  }
}

/* -------------------------------------------------------------------------- */
/* LOGIN                                                                      */
/* -------------------------------------------------------------------------- */

export async function loginAction(formData: FormData) {
  const h = await headers();
  const ip = getClientIp(h);

  const limitKey = `login:${ip}`;

  const rl = await checkFailureLimit(limitKey);

  if (!rl.allowed) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    redirect("/admin/real/login");
  }

  const password = String(formData.get("password") ?? "");

  const isValid = await checkPassword(password);

  if (!isValid) {
    await recordFailure(limitKey, {
      maxAttempts: LOGIN_MAX_ATTEMPTS,
      banMs: LOGIN_BAN_MS,
    });

    await new Promise((resolve) => setTimeout(resolve, 800));

    redirect("/admin/real/login?error=1");
  }

  await resetFailures(limitKey);

  const sessionToken = await getExpectedSessionToken();

  if (!sessionToken) {
    redirect("/admin/real/login?error=1");
  }

  const cookieStore = await cookies();

  cookieStore.set("admin_session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/admin/real");
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete("admin_session");

  redirect("/admin/real/login");
}

/* -------------------------------------------------------------------------- */
/* VEHICLE IMAGE UPLOAD                                                       */
/* -------------------------------------------------------------------------- */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const STORAGE_BUCKET = "vehicles";

/**
 * Verify the real file type from magic bytes.
 * The declared MIME type is client-controlled.
 */
async function sniffImageType(file: File): Promise<string | null> {
  const buffer = new Uint8Array(
    await file.slice(0, 12).arrayBuffer()
  );

  // JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }

  // WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

async function uploadIfPresent(
  formData: FormData
): Promise<string | null> {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  const file = value;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      `Type de fichier non autorisé : ${
        file.type || "inconnu"
      }. Formats acceptés : JPEG, PNG, WEBP, GIF.`
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Le fichier dépasse la taille maximale autorisée (5 Mo)."
    );
  }

  const sniffed = await sniffImageType(file);

  if (!sniffed) {
    throw new Error(
      "Le contenu du fichier ne correspond pas à une image valide (JPEG, PNG, WEBP, GIF)."
    );
  }

  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");

  const fileName = `${Date.now()}-${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      contentType: sniffed,
      upsert: false,
    });

  if (error) {
    throw new Error(`Échec de l'upload : ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function removeStorageObject(
  publicUrl: string | null | undefined
) {
  if (!publicUrl) {
    return;
  }

  try {
    const marker = `/object/public/${STORAGE_BUCKET}/`;

    const index = publicUrl.indexOf(marker);

    if (index === -1) {
      return;
    }

    const path = publicUrl.slice(index + marker.length);

    if (!path) {
      return;
    }

    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([path]);
  } catch {
    // Storage cleanup should never block the database operation.
  }
}

/* -------------------------------------------------------------------------- */
/* CACHE                                                                      */
/* -------------------------------------------------------------------------- */

function revalidateAll() {
  revalidatePath("/admin/real");
  revalidatePath("/vehicules");
  revalidatePath("/");
}

/* -------------------------------------------------------------------------- */
/* VEHICLES                                                                   */
/* -------------------------------------------------------------------------- */

export async function createVehicleAction(formData: FormData) {
  await requireAdmin();

  const uploadedUrl = await uploadIfPresent(formData);

  await createVehicle({
    brand: String(formData.get("brand") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    price_per_day: Number(formData.get("price_per_day")),
    description: String(formData.get("description") ?? ""),
    image_url: uploadedUrl ?? "",
  });

  revalidateAll();

  redirect("/admin/real");
}

export async function updateVehicleAction(
  id: number,
  formData: FormData
) {
  await requireAdmin();

  const uploadedUrl = await uploadIfPresent(formData);

  const existingUrl = String(
    formData.get("existing_image_url") ?? ""
  );

  await updateVehicle(id, {
    brand: String(formData.get("brand") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    price_per_day: Number(formData.get("price_per_day")),
    description: String(formData.get("description") ?? ""),
    image_url: uploadedUrl ?? existingUrl,
  });

  if (
    uploadedUrl &&
    existingUrl &&
    uploadedUrl !== existingUrl
  ) {
    await removeStorageObject(existingUrl);
  }

  revalidateAll();

  redirect("/admin/real");
}

export async function deleteVehicleAction(id: number) {
  await requireAdmin();

  const vehicle = await getVehicleById(id);

  await deleteVehicle(id);

  await removeStorageObject(vehicle?.image_url);

  revalidateAll();
}

/* -------------------------------------------------------------------------- */
/* RESERVATION STATUS                                                         */
/* -------------------------------------------------------------------------- */

export async function updateReservationStatusAction(
  id: number,
  status: ReservationStatus
) {
  await requireAdmin();

  if (status === "confirmed") {
    const result = await confirmReservation(id);

    if (!result.ok) {
      revalidatePath("/admin/real/reservations");

      redirect(
        `/admin/real/reservations/${id}?error=${encodeURIComponent(
          result.reason
        )}`
      );
    }
  } else {
    await updateReservationStatus(id, status);
  }

  revalidatePath("/admin/real/reservations");
  revalidatePath(`/admin/real/reservations/${id}`);
}

export async function deleteReservationAction(id: number) {
  await requireAdmin();

  await deleteReservation(id);

  revalidatePath("/admin/real/reservations");
}

/* -------------------------------------------------------------------------- */
/* WALK-IN RESERVATION                                                        */
/* -------------------------------------------------------------------------- */

export async function createWalkInReservationAction(
  formData: FormData
) {
  await requireAdmin();

  const vehicleId = Number(
    formData.get("vehicle_id")
  );

  const vehicle = await getVehicleById(vehicleId);

  if (!vehicle) {
    throw new Error("Vehicule introuvable.");
  }

  const startDate = String(
    formData.get("start_date") || ""
  );

  const endDate = String(
    formData.get("end_date") || ""
  );

  if (
    !startDate ||
    !endDate ||
    new Date(endDate) <= new Date(startDate)
  ) {
    throw new Error(
      "La date de retour doit etre apres la date de depart."
    );
  }

  const hasSecondDriver =
    formData.get("has_second_driver") === "on";

  const text = (name: string) =>
    String(formData.get(name) || "").trim();

  const result = await createWalkInReservation({
    vehicle_id: vehicle.id,

    vehicle_label: `${vehicle.brand} ${vehicle.model}`,

    prenom: text("prenom"),
    nom: text("nom"),
    date_naissance: text("date_naissance"),
    cin_number: text("cin_number"),
    license_issue_date: text("license_issue_date"),

    driver_address: text("driver_address"),
    driver_phone: text("driver_phone"),
    driver_license_number: text(
      "driver_license_number"
    ),
    driver_passport_number: text(
      "driver_passport_number"
    ),

    has_second_driver: hasSecondDriver,

    second_driver_prenom: hasSecondDriver
      ? text("second_driver_prenom")
      : "",

    second_driver_nom: hasSecondDriver
      ? text("second_driver_nom")
      : "",

    second_driver_address: hasSecondDriver
      ? text("second_driver_address")
      : "",

    second_driver_phone: hasSecondDriver
      ? text("second_driver_phone")
      : "",

    second_driver_cin_number: hasSecondDriver
      ? text("second_driver_cin_number")
      : "",

    second_driver_license_number: hasSecondDriver
      ? text("second_driver_license_number")
      : "",

    second_driver_passport_number: hasSecondDriver
      ? text("second_driver_passport_number")
      : "",

    start_date: startDate,
    end_date: endDate,

    start_time: text("start_time") || "10:00",
    end_time: text("end_time") || "10:00",

    fait_a: text("fait_a"),
  });

  if (!result.ok) {
    throw new Error(
      "Ce vehicule n'est pas disponible sur ces dates."
    );
  }

  revalidatePath("/admin/real/reservations");

  redirect(
    `/admin/real/reservations/${result.reservation.id}`
  );
}

/* -------------------------------------------------------------------------- */
/* RESERVATION HANDOVER                                                       */
/* -------------------------------------------------------------------------- */

export async function updateReservationHandoverAction(
  id: number,
  formData: FormData
) {
  await requireAdmin();

  const registrationPlate = String(
    formData.get("registration_plate") || ""
  ).trim();

  const mileageStartRaw =
    formData.get("mileage_start");

  const mileageEndRaw =
    formData.get("mileage_end");

  const mileageStart =
    mileageStartRaw &&
    mileageStartRaw !== ""
      ? Number(mileageStartRaw)
      : null;

  const mileageEnd =
    mileageEndRaw &&
    mileageEndRaw !== ""
      ? Number(mileageEndRaw)
      : null;

  const fuelType = String(
    formData.get("fuel_type") || ""
  );

  const fuelLevelOutRaw =
    formData.get("fuel_level_out");

  const fuelLevelInRaw =
    formData.get("fuel_level_in");

  const fuelLevelOut =
    fuelLevelOutRaw &&
    fuelLevelOutRaw !== ""
      ? Number(fuelLevelOutRaw)
      : null;

  const fuelLevelIn =
    fuelLevelInRaw &&
    fuelLevelInRaw !== ""
      ? Number(fuelLevelInRaw)
      : null;

  const deliveryFee = Number(
    formData.get("delivery_fee") || 0
  );

  const pickupFee = Number(
    formData.get("pickup_fee") || 0
  );

  let damages: DamageEntry[] = [];

  try {
    const raw = String(
      formData.get("damages_json") || "[]"
    );

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      damages = parsed;
    }
  } catch {
    damages = [];
  }

  const equipment: EquipmentChecklist = {};

  for (const item of EQUIPMENT_ITEMS) {
    equipment[item.key] =
      formData.get(
        `equipment__${item.key}`
      ) === "on";
  }

  await updateReservationHandover(id, {
    registration_plate: registrationPlate,

    mileage_start: mileageStart,
    mileage_end: mileageEnd,

    damages,
    equipment,

    fuel_type: fuelType,

    fuel_level_out: fuelLevelOut,
    fuel_level_in: fuelLevelIn,

    delivery_fee: deliveryFee,
    pickup_fee: pickupFee,
  });

  revalidatePath(
    `/admin/real/reservations/${id}`
  );

  revalidatePath(
    "/admin/real/reservations"
  );
}

/* -------------------------------------------------------------------------- */
/* RESERVATION CONTRACT                                                       */
/* -------------------------------------------------------------------------- */

export async function updateReservationContractAction(
  id: number,
  formData: FormData
) {
  await requireAdmin();

  const reservation = await getReservationById(id);

  if (!reservation) {
    notFound();
  }

  const text = (name: string) =>
    String(formData.get(name) ?? "").trim();

  const numberOrNull = (name: string) => {
    const value = String(
      formData.get(name) ?? ""
    ).trim();

    if (value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  };

  const dateOrNull = (name: string) => {
    const value = String(
      formData.get(name) ?? ""
    ).trim();

    return value === "" ? null : value;
  };

  let damages: DamageEntry[] = [];

  try {
    const raw = String(
      formData.get("damages_json") ?? "[]"
    );

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      damages = parsed;
    }
  } catch {
    damages = [];
  }

  const equipment: EquipmentChecklist = {};

  for (const item of EQUIPMENT_ITEMS) {
    equipment[item.key] =
      formData.get(
        `equipment__${item.key}`
      ) === "on";
  }

  const avance =
    Number(text("avance")) || 0;

  const overrideTotalTtc =
    numberOrNull("override_total_ttc");

  await updateReservationContract(id, {
    prenom: text("prenom"),
    nom: text("nom"),

    date_naissance:
      text("date_naissance"),

    cin_number:
      text("cin_number"),

    cin_delivered_le:
      dateOrNull("cin_delivered_le"),

    license_issue_date:
      text("license_issue_date"),

    driver_address:
      text("driver_address"),

    driver_phone:
      text("driver_phone"),

    driver_license_number:
      text("driver_license_number"),

    driver_passport_number:
      text("driver_passport_number"),

    passport_delivered_le:
      dateOrNull("passport_delivered_le"),

    has_second_driver:
      formData.get(
        "has_second_driver"
      ) === "on",

    second_driver_prenom:
      text("second_driver_prenom"),

    second_driver_nom:
      text("second_driver_nom"),

    second_driver_date_naissance:
      dateOrNull(
        "second_driver_date_naissance"
      ),

    second_driver_address:
      text("second_driver_address"),

    second_driver_phone:
      text("second_driver_phone"),

    second_driver_cin_number:
      text("second_driver_cin_number"),

    second_driver_cin_delivered_le:
      dateOrNull(
        "second_driver_cin_delivered_le"
      ),

    second_driver_license_number:
      text(
        "second_driver_license_number"
      ),

    second_driver_passport_number:
      text(
        "second_driver_passport_number"
      ),

    second_driver_passport_delivered_le:
      dateOrNull(
        "second_driver_passport_delivered_le"
      ),

    vehicle_label:
      text("vehicle_label"),

    registration_plate:
      text("registration_plate"),

    start_date:
      text("start_date"),

    end_date:
      text("end_date"),

    start_time:
      text("start_time"),

    end_time:
      text("end_time"),

    lieu_livraison_depart:
      text("lieu_livraison_depart"),

    lieu_livraison_retour:
      text("lieu_livraison_retour"),

    retour_prevu_le:
      dateOrNull("retour_prevu_le"),

    prolongation:
      text("prolongation"),

    mileage_start:
      numberOrNull("mileage_start"),

    mileage_end:
      numberOrNull("mileage_end"),

    damages,

    equipment,

    fuel_type:
      text("fuel_type"),

    fuel_level_out:
      numberOrNull("fuel_level_out"),

    fuel_level_in:
      numberOrNull("fuel_level_in"),

    delivery_fee:
      Number(text("delivery_fee")) || 0,

    pickup_fee:
      Number(text("pickup_fee")) || 0,

    fait_a:
      text("fait_a"),

    override_total_ttc:
      overrideTotalTtc,

    avance,

    reste_a_payer:
      overrideTotalTtc !== null
        ? overrideTotalTtc - avance
        : 0,
  });

  revalidatePath(
    `/admin/real/reservations/${id}`
  );

  revalidatePath(
    `/admin/real/reservations/${id}/edit-contract`
  );

  revalidatePath(
    `/admin/real/reservations/${id}/contract`
  );

  revalidatePath(
    "/admin/real/reservations"
  );

  revalidatePath(
    "/admin/real/contracts"
  );

  redirect(
    `/admin/real/reservations/${id}`
  );
}

/* -------------------------------------------------------------------------- */
/* ADMIN SIGNATURE                                                            */
/* -------------------------------------------------------------------------- */

export async function recordAdminSignatureAction(
  id: number,
  data: {
    admin_signer_name: string;
    admin_signature_data: string;
  }
) {
  await requireAdmin();

  await recordAdminSignature(id, data);

  revalidatePath(
    `/admin/real/reservations/${id}`
  );

  revalidatePath(
    `/admin/real/reservations/${id}/contract`
  );
}

export type AdminSignatureState = {
  ok: boolean;
  error: string;
};

export async function recordAdminSignatureFormAction(
  id: number,
  _prev: AdminSignatureState,
  formData: FormData
): Promise<AdminSignatureState> {
  await requireAdmin();

  const reservation =
    await getReservationById(id);

  if (!reservation) {
    return {
      ok: false,
      error: "Reservation introuvable.",
    };
  }

  if (reservation.status === "cancelled") {
    return {
      ok: false,
      error: "Reservation annulee.",
    };
  }

  if (reservation.admin_signed_at) {
    return {
      ok: false,
      error: "Deja contresigne.",
    };
  }

  if (!reservation.signed_at) {
    return {
      ok: false,
      error:
        "Le client n a pas encore signe.",
    };
  }

  const adminSignerName = String(
    formData.get("admin_signer_name") || ""
  ).trim();

  const signature = String(
    formData.get("admin_signature_data") || ""
  );

  if (adminSignerName.length < 2) {
    return {
      ok: false,
      error: "Nom requis.",
    };
  }

  if (
    !signature.startsWith(
      "data:image/png;base64,"
    )
  ) {
    return {
      ok: false,
      error: "Signature invalide.",
    };
  }

  await recordAdminSignature(id, {
    admin_signer_name: adminSignerName,
    admin_signature_data: signature,
  });

  revalidatePath(
    `/admin/real/reservations/${id}`
  );

  revalidatePath(
    `/admin/real/reservations/${id}/contract`
  );

  return {
    ok: true,
    error: "",
  };
}

/* -------------------------------------------------------------------------- */
/* PHONE / WHATSAPP                                                           */
/* -------------------------------------------------------------------------- */

function normalizePhoneForWa(
  raw: string
): string | null {
  const digits = raw.replace(/\D/g, "");

  // International format without +
  if (/^00\d{9,15}$/.test(digits)) {
    return digits.slice(2);
  }

  // Moroccan local number
  if (/^0\d{9}$/.test(digits)) {
    return `212${digits.slice(1)}`;
  }

  // Moroccan international number
  if (/^212\d{9}$/.test(digits)) {
    return digits;
  }

  // Generic international number
  if (/^[1-9]\d{8,14}$/.test(digits)) {
    return digits;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* PUBLIC ORIGIN                                                              */
/* -------------------------------------------------------------------------- */

async function getPublicOrigin(): Promise<string> {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL
      ?.trim()
      .replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  const h = await headers();

  const origin = h.get("origin");

  if (origin && origin !== "null") {
    return origin.replace(/\/+$/, "");
  }

  const host =
    h.get("x-forwarded-host") ||
    h.get("host");

  if (!host) {
    return "";
  }

  const forwardedProto =
    h.get("x-forwarded-proto");

  const protocol =
    forwardedProto ||
    (host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

/* -------------------------------------------------------------------------- */
/* CLIENT SIGNING LINK                                                        */
/* -------------------------------------------------------------------------- */

export async function generateSigningLinkAction(
  id: number
): Promise<
  | {
      ok: true;
      signingUrl: string;
      waUrl: string | null;
    }
  | {
      ok: false;
      error:
        | "notFound"
        | "cancelled"
        | "alreadySigned";
    }
> {
  await requireAdmin();

  const reservation =
    await getReservationById(id);

  if (!reservation) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  if (reservation.status === "cancelled") {
    return {
      ok: false,
      error: "cancelled",
    };
  }

  if (reservation.signed_at) {
    return {
      ok: false,
      error: "alreadySigned",
    };
  }

  const token =
    await createSigningToken(id);

  if (!token) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  const origin =
    await getPublicOrigin();

  if (!origin) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  const signingUrl =
    `${origin}/sign/${token}`;

  const phone =
    normalizePhoneForWa(
      reservation.driver_phone
    );

  const message = encodeURIComponent(
    `Bonjour ${reservation.prenom} ${reservation.nom}, ` +
      `voici votre contrat de location ` +
      `(${reservation.vehicle_label}) ` +
      `à signer : ${signingUrl} - ` +
      `lien valable 7 jours.`
  );

  const waUrl = phone
    ? `https://wa.me/${phone}?text=${message}`
    : null;

  return {
    ok: true,
    signingUrl,
    waUrl,
  };
}

/* -------------------------------------------------------------------------- */
/* SECOND DRIVER SIGNING LINK                                                 */
/* -------------------------------------------------------------------------- */

export async function generateSigningLinkAction2(
  id: number
): Promise<
  | {
      ok: true;
      signingUrl: string;
      waUrl: string | null;
    }
  | {
      ok: false;
      error:
        | "notFound"
        | "cancelled"
        | "alreadySigned"
        | "noSecondDriver";
    }
> {
  await requireAdmin();

  const reservation =
    await getReservationById(id);

  if (!reservation) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  if (!reservation.has_second_driver) {
    return {
      ok: false,
      error: "noSecondDriver",
    };
  }

  if (reservation.status === "cancelled") {
    return {
      ok: false,
      error: "cancelled",
    };
  }

  if (reservation.signed_2_at) {
    return {
      ok: false,
      error: "alreadySigned",
    };
  }

  const token =
    await createSigningToken2(id);

  if (!token) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  const origin =
    await getPublicOrigin();

  if (!origin) {
    return {
      ok: false,
      error: "notFound",
    };
  }

  const signingUrl =
    `${origin}/sign/${token}`;

  const phone =
    normalizePhoneForWa(
      reservation.second_driver_phone
    );

  const message = encodeURIComponent(
    `Bonjour ${reservation.second_driver_prenom} ` +
      `${reservation.second_driver_nom}, ` +
      `voici votre contrat de location ` +
      `(${reservation.vehicle_label}) ` +
      `à signer : ${signingUrl} - ` +
      `lien valable 7 jours.`
  );

  const waUrl = phone
    ? `https://wa.me/${phone}?text=${message}`
    : null;

  return {
    ok: true,
    signingUrl,
    waUrl,
  };
}
