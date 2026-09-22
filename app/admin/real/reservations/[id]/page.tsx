
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import {
  getReservationById,
  getVehicleById,
  type ReservationStatus,
} from "@/lib/db";
import {
  updateReservationStatusAction,
  updateReservationHandoverAction,
  deleteReservationAction,
} from "@/app/admin/real/actions";
import {
  resolveBilling,
  getFullName,
  calculateAge,
  DEFAULT_MIN_RENTAL_DAYS,
} from "@/lib/contract";
import AdminSidebar from "@/components/admin/AdminSidebar";
import HandoverForm from "@/components/admin/HandoverForm";
import SendSigningLinkButton from "@/components/admin/SendSigningLinkButton";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "En attente",
  contacted: "Contactée",
  confirmed: "Confirmée",
  cancelled: "Annulée",
};

const STATUS_OPTIONS: ReservationStatus[] = [
  "pending",
  "contacted",
  "confirmed",
  "cancelled",
];

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-black/40">{label}</dt>
      <dd className="font-medium text-black/80">{value}</dd>
    </div>
  );
}

export default async function AdminReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const reservation = await getReservationById(Number(id));

  if (!reservation) {
    notFound();
  }

  const vehicle = reservation.vehicle_id
    ? await getVehicleById(reservation.vehicle_id)
    : null;

  const vehiclePricing = {
    price_per_day: vehicle?.price_per_day ?? 0,
    price_extended_15:
      vehicle?.price_extended_15 ?? vehicle?.price_per_day ?? 0,
    price_monthly_30:
      vehicle?.price_monthly_30 ?? vehicle?.price_per_day ?? 0,
    min_rental_days:
      vehicle?.min_rental_days ?? DEFAULT_MIN_RENTAL_DAYS,
  };

  const billing = resolveBilling(vehiclePricing, reservation);

  return (
    <div className="min-h-screen bg-[var(--color-mist)]/40 lg:flex">
      <AdminSidebar active="reservations" />

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/admin/real/reservations"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-black/50 transition-colors hover:text-black/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Réservations
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                Réservation #{reservation.id} — {getFullName(reservation)}
              </h1>

              {reservation.contract_number && (
                <p className="mt-1 text-xs font-semibold text-black/40">
                  Contrat {reservation.contract_number}
                </p>
              )}
            </div>

            <span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-black/60">
              {STATUS_LABELS[reservation.status]}
            </span>
          </div>

          {error === "conflict" && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              Impossible de confirmer : ce véhicule a déjà une réservation
              confirmée qui chevauche ces dates.
            </p>
          )}

          {error === "notFound" && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              Réservation ou véhicule introuvable.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.filter(
              (status) => status !== reservation.status
            ).map((status) => (
              <form
                key={status}
                action={updateReservationStatusAction.bind(
                  null,
                  reservation.id,
                  status
                )}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5"
                >
                  Marquer {STATUS_LABELS[status]}
                </button>
              </form>
            ))}

            {reservation.contract_number ? (
              <a
                href={`/admin/real/reservations/${reservation.id}/contract`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5"
              >
                <FileText className="h-3.5 w-3.5" />
                Voir / réimprimer le contrat
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Confirmez la réservation pour générer le contrat"
                className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-black/30"
              >
                <FileText className="h-3.5 w-3.5" />
                Générer le contrat
              </button>
            )}

            <Link
              href={`/admin/real/reservations/${reservation.id}/edit-contract`}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5"
            >
              Modifier le contrat
            </Link>

            <SendSigningLinkButton
              reservationId={reservation.id}
              signedAt={reservation.signed_at}
              isWalkIn={reservation.source === "walk_in"}
            />

            {reservation.has_second_driver && (
              <SendSigningLinkButton
                reservationId={reservation.id}
                signedAt={reservation.signed_2_at}
                driver="second"
                label="Envoyer au 2e conducteur"
                isWalkIn={reservation.source === "walk_in"}
              />
            )}

            {reservation.signed_at &&
              (!reservation.has_second_driver || reservation.signed_2_at) &&
              !reservation.admin_signed_at && (
                <a
                  href={`/admin/real/reservations/${reservation.id}/countersign`}
                  className="rounded-lg border border-black px-3 py-1.5 text-xs font-semibold hover:bg-black hover:text-white"
                >
                  Contresigner
                </a>
              )}

            {reservation.admin_signed_at && (
              <span className="text-xs font-semibold text-emerald-700">
                Agence signe le{" "}
                {new Date(reservation.admin_signed_at).toLocaleString(
                  "fr-FR"
                )}
              </span>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-black/10 bg-white p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
                Conducteur
              </h2>

              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <Row
                  label="Nom"
                  value={getFullName(reservation)}
                />

                <Row
                  label="Âge"
                  value={`${calculateAge(reservation.date_naissance)} ans`}
                />

                <Row
                  label="CIN"
                  value={reservation.cin_number}
                />

                <Row
                  label="Permis N°"
                  value={reservation.driver_license_number || "—"}
                />

                <Row
                  label="Permis obtenu le"
                  value={formatDate(reservation.license_issue_date)}
                />

                <Row
                  label="Passeport N°"
                  value={reservation.driver_passport_number || "—"}
                />

                <Row
                  label="Adresse"
                  value={reservation.driver_address || "—"}
                />

                <Row
                  label="Téléphone"
                  value={reservation.driver_phone || "—"}
                />
              </dl>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
                Autre conducteur
              </h2>

              {reservation.has_second_driver ? (
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <Row
                    label="Nom"
                    value={
                      getFullName({
                        prenom: reservation.second_driver_prenom,
                        nom: reservation.second_driver_nom,
                      }) || "—"
                    }
                  />

                  <Row
                    label="CIN"
                    value={reservation.second_driver_cin_number || "—"}
                  />

                  <Row
                    label="Permis N°"
                    value={
                      reservation.second_driver_license_number || "—"
                    }
                  />

                  <Row
                    label="Passeport N°"
                    value={
                      reservation.second_driver_passport_number || "—"
                    }
                  />

                  <Row
                    label="Adresse"
                    value={reservation.second_driver_address || "—"}
                  />

                  <Row
                    label="Téléphone"
                    value={reservation.second_driver_phone || "—"}
                  />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-black/40">
                  Aucun autre conducteur.
                </p>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
              Véhicule &amp; période
            </h2>

            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Row
                label="Véhicule"
                value={reservation.vehicle_label}
              />

              <Row
                label="Prix / jour"
                value={
                  vehicle
                    ? `${vehicle.price_per_day} DH`
                    : "Véhicule supprimé"
                }
              />

              <Row
                label="Départ"
                value={`${formatDate(reservation.start_date)} à ${reservation.start_time}`}
              />

              <Row
                label="Retour"
                value={`${formatDate(reservation.end_date)} à ${reservation.end_time}`}
              />
            </dl>
          </section>

          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
              Facturation (estimée)
            </h2>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Row
                label="Jours"
                value={`${billing.days}`}
              />

              <Row
                label="Total TTC"
                value={`${billing.totalTTC.toFixed(2)} DH`}
              />

              <Row
                label="Avance"
                value={`${billing.avance.toFixed(2)} DH`}
              />

              <Row
                label="Reste à payer"
                value={`${billing.resteAPayer.toFixed(2)} DH`}
              />
            </dl>
          </section>

          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
              Complétion remise du véhicule
            </h2>

            <div className="mt-4">
              <HandoverForm
                action={updateReservationHandoverAction.bind(
                  null,
                  reservation.id
                )}
                initial={{
                  registration_plate: reservation.registration_plate,
                  mileage_start: reservation.mileage_start,
                  mileage_end: reservation.mileage_end,
                  damages: reservation.damages,
                  equipment: reservation.equipment,
                  fuel_type: reservation.fuel_type,
                  fuel_level_out: reservation.fuel_level_out,
                  fuel_level_in: reservation.fuel_level_in,
                  delivery_fee: Number(reservation.delivery_fee),
                  pickup_fee: Number(reservation.pickup_fee),
                }}
              />
            </div>
          </section>

          <div className="mt-6">
            <form
              action={deleteReservationAction.bind(
                null,
                reservation.id
              )}
            >
              <button
                type="submit"
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Supprimer la réservation
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
