import Link from "next/link";
import { FileText, FileSearch, Pencil } from "lucide-react";
import { getReservations } from "@/lib/db";
import { getFullName } from "@/lib/contract";
import AdminSidebar from "@/components/admin/AdminSidebar";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  contacted: "Contacté",
  confirmed: "Confirmé",
  cancelled: "Annulé",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  contacted: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const reservations = await getReservations();

  const contracts = reservations.filter(
    (reservation) => Boolean(reservation.contract_number)
  );

  const query = (q ?? "").trim().toLowerCase();

  const filtered = query
    ? contracts.filter((reservation) => {
        const contractNumber =
          reservation.contract_number?.toLowerCase() ?? "";

        return (
          contractNumber.includes(query) ||
          getFullName(reservation).toLowerCase().includes(query) ||
          reservation.vehicle_label.toLowerCase().includes(query) ||
          reservation.registration_plate.toLowerCase().includes(query)
        );
      })
    : contracts;

  return (
    <div className="min-h-screen bg-[var(--color-mist)]/40 lg:flex">
      <AdminSidebar active="contracts" />

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-red-primary)]/10 text-[var(--color-red-primary)]">
                  <FileText className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                    Contrats
                  </h1>

                  <p className="mt-1 text-sm text-black/50">
                    Gérez et modifiez vos contrats indépendamment des fiches
                    clients.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-black/5">
              {contracts.length} contrat
              {contracts.length > 1 ? "s" : ""}
            </div>
          </div>

          <form className="mt-6">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Rechercher par N° contrat, client, véhicule ou immatriculation..."
              className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-black/35 focus:border-[var(--color-red-primary)] sm:max-w-xl"
            />
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            {filtered.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/5 text-black/35">
                  <FileText className="h-6 w-6" />
                </div>

                <p className="mt-4 font-semibold text-[var(--color-ink)]">
                  {contracts.length === 0
                    ? "Aucun contrat généré"
                    : "Aucun contrat trouvé"}
                </p>

                <p className="mx-auto mt-1 max-w-md text-sm text-black/45">
                  {contracts.length === 0
                    ? "Un contrat est créé automatiquement lorsqu'une réservation est confirmée."
                    : "Essayez avec un autre numéro de contrat, client ou véhicule."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {filtered.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-black/[0.015] lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 text-black/45">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display font-bold text-[var(--color-ink)]">
                            {reservation.contract_number}
                          </p>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              STATUS_BADGE[reservation.status] ??
                              "bg-gray-50 text-gray-700"
                            }`}
                          >
                            {STATUS_LABELS[reservation.status] ??
                              reservation.status}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-semibold text-black/70">
                          {getFullName(reservation)}
                        </p>

                        <p className="text-sm text-black/45">
                          {reservation.vehicle_label}
                          {reservation.registration_plate
                            ? ` · ${reservation.registration_plate}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-black/35">
                          {formatDate(reservation.start_date)} →{" "}
                          {formatDate(reservation.end_date)}
                          {" · "}
                          Généré le{" "}
                          {formatDateTime(reservation.contract_generated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={`/admin/real/reservations/${reservation.id}/contract`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold text-black/70 transition-colors hover:bg-black/5"
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        Voir PDF
                      </a>

                      <Link
                        href={`/admin/real/reservations/${reservation.id}/edit-contract`}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-red-primary)] px-3 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}