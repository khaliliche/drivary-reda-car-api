"use server";

import { headers } from "next/headers";
import {
  consumeSigningToken,
  consumeSigningToken2,
  getReservationBySigningToken,
  isSecondDriverToken,
} from "@/lib/db";
import {
  getClientIp,
  checkFailureLimit,
  recordFailure,
  resetFailures,
  SIGN_MAX_ATTEMPTS,
  SIGN_BAN_MS,
} from "@/lib/auth";

export type SignatureActionState = { ok: boolean; error: string; redirectTo?: string };

const MAX_SIGNATURE_CHARS = 400_000; // ~300 KB de base64, far above a real PNG

export async function submitSignatureAction(
  token: string,
  _prevState: SignatureActionState,
  formData: FormData
): Promise<SignatureActionState> {
  // Honeypot: real users never fill this; bots get a fake success.
  if (String(formData.get("website") || "").trim() !== "") {
    return { ok: true, error: "" };
  }

  const h = await headers();
  const ip = getClientIp(h);

  const limitKey = `sign:${ip}`;
  const rl = await checkFailureLimit(limitKey);
  if (!rl.allowed) {
    return {
      ok: false,
      error: "Trop de tentatives. Reessayez dans quelques minutes."
    };
  }

  const signerName = String(formData.get("signer_name") || "").trim();
  const signature = String(formData.get("signature") || "");

  if (signerName.length < 3 || signerName.length > 120) {
    await recordFailure(limitKey, {
      maxAttempts: SIGN_MAX_ATTEMPTS,
      banMs: SIGN_BAN_MS,
    });
    return { ok: false, error: "Nom incomplet." };
  }

  if (
    !signature.startsWith("data:image/png;base64,") ||
    signature.length > MAX_SIGNATURE_CHARS
  ) {
    await recordFailure(limitKey, {
      maxAttempts: SIGN_MAX_ATTEMPTS,
      banMs: SIGN_BAN_MS,
    });
    return {
      ok: false,
      error: "Signature invalide, veuillez recommencer."
    };
  }

  // The token can belong to either driver's independent signing slot -
  // look up the reservation first so we consume it against the right one.
  const reservation = await getReservationBySigningToken(token);
  if (!reservation) {
    await recordFailure(limitKey, {
      maxAttempts: SIGN_MAX_ATTEMPTS,
      banMs: SIGN_BAN_MS,
    });
    return {
      ok: false,
      error: "Lien invalide, expire ou deja utilise."
    };
  }

  const isSecond = isSecondDriverToken(reservation, token);

  const consumed = isSecond
    ? await consumeSigningToken2(token, {
        signer_name: signerName,
        signer_ip: ip,
        signature_data: signature,
      })
    : await consumeSigningToken(token, {
        signer_name: signerName,
        signer_ip: ip,
        signature_data: signature,
      });

  if (!consumed) {
    return {
      ok: false,
      error: "Lien invalide, expire ou deja utilise."
    };
  }

  await resetFailures(limitKey);

  // Walk-in only: once every required customer signature is in, send the
  // same device straight to the admin countersign screen. Online/remote
  // signers never get this - their browser has no admin session anyway.
  const mainDone = isSecond ? Boolean(reservation.signed_at) : true;
  const secondDone = isSecond
    ? true
    : !reservation.has_second_driver || Boolean(reservation.signed_2_at);
  const readyForCountersign =
    reservation.source === "walk_in" && mainDone && secondDone;

  return {
    ok: true,
    error: "",
    redirectTo: readyForCountersign
      ? `/admin/real/reservations/${reservation.id}/countersign`
      : undefined,
  };
}