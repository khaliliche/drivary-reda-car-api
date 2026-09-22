import Link from "next/link";
import { getReservations, getVehicles } from "@/lib/db";
import { getFullName, calculateAge } from "@/lib/contract";
import { updateReservationStatusAction, deleteReservationAction } from "@/app/admin/real/actions";
import { CalendarClock, Clock, CheckCircle2, Wallet, Plus } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  contacted: "Contacté",
  confirmed: "Confirmé",
  cancelled: "Annulé",
};
const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  contacted: "bg-blue-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  contacted: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};
const AVATAR_COLORS = [
  "bg-[var(--color-red-primary)]",
  "bg-[var(--color-brass)]",
  "bg-[var(--color-clay)]",
  "bg-[var(--color-ink)]",
];
const STATUS_OPTIONS = ["pending", "contacted", "confirmed", "cancelled"] as const;

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function daysBetween(start: string | Date, end: string | Date) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}
function licenseYears(issueDate: string | Date) {
  const years = (Date.now() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return years < 1 ? "< 1 an" : `${Math.floor(years)} an(s)`;
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
function avatarColor(name: string) {
  const idx = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: activeFilter } = await searchParams;
  const [reservations, vehicles] = await Promise.all([getReservations(), getVehicles()]);

  const priceByVehicleId = new Map(vehicles.map((v) => [v.id, Number(v.price_per_day)]));
  const counts = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const confirmedRevenue = reservations
    .filter((r) => r.status === "confirmed")
    .reduce((sum, r) => {
      const price = r.vehicle_id ? priceByVehicleId.get(r.vehicle_id) ?? 0 : 0;
      return sum + price * daysBetween(r.start_date, r.end_date);
    }, 0);

  const filtered =
    activeFilter && STATUS_OPTIONS.includes(activeFilter as (typeof STATUS_OPTIONS)[number])
      ? reservations.filter((r) => r.status === activeFilter)
      : reservations;

  return (
    <div className="min-h-screen bg-[var(--color-mist)]/40 lg:flex">
      <AdminSidebar active="reservations" />

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
                Réservations
              </h1>
              <p className="mt-1 text-sm text-black/50">{reservations.length} au total</p>
            </div>
            <Link
              href="/admin/real/reservations/new"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-red-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              Nouvelle location
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={CalendarClock} label="Total" value={reservations.length} tone="ink" />
            <StatCard icon={Clock} label="En attente" value={counts.pending ?? 0} tone="yellow" />
            <StatCard icon={CheckCircle2} label="Confirmées" value={counts.confirmed ?? 0} tone="green" />
            <StatCard icon={Wallet} label="Revenu confirmé" value={`${confirmedRevenue.toLocaleString("fr-FR")} DH`} tone="ink" />
          </div>

          <div className="mt-8 flex flex-wrap gap-2 border-b border-black/10 pb-4">
            <Link
              href="/admin/real/reservations"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !activeFilter ? "bg-[var(--color-ink)] text-white" : "bg-black/5 text-black/60 hover:bg-black/10"
              }`}
            >
              Toutes · {reservations.length}
            </Link>
            {STATUS_OPTIONS.map((status) => (
              <Link
                key={status}
                href={`/admin/real/reservations?status=${status}`}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === status ? "bg-[var(--color-ink)] text-white" : "bg-black/5 text-black/60 hover:bg-black/10"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
                {STATUS_LABELS[status]} · {counts[status] ?? 0}
              </Link>
            ))}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-black/10 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-black/40">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Véhicule</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Durée</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.015]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/real/reservations/${r.id}`}
                        className="flex items-center gap-2.5 hover:opacity-80"
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(getFullName(r))}`}>
                          {initials(getFullName(r))}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-ink)]">{getFullName(r)}</p>
                          <p className="text-xs text-black/40">{calculateAge(r.date_naissance)} ans · CIN {r.cin_number} · Permis {licenseYears(r.license_issue_date)}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-black/70">{r.vehicle_label}</td>
                    <td className="px-4 py-3 text-black/70">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)}
                    </td>
                    <td className="px-4 py-3 text-black/70">{daysBetween(r.start_date, r.end_date)} j</td>
                    <td className="px-4 py-3">
                      <span className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {STATUS_OPTIONS.filter((s) => s !== r.status).map((status) => (
                          <form key={status} action={updateReservationStatusAction.bind(null, r.id, status)}>
                            <button
                              type="submit"
                              className="rounded-md border border-black/15 px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-black/5"
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          </form>
                        ))}
                        <form action={deleteReservationAction.bind(null, r.id)}>
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            Suppr.
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <p className="p-8 text-center text-black/50">Aucune réservation ici.</p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {filtered.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-black/50">
                Aucune réservation ici.
              </p>
            )}
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/admin/real/reservations/${r.id}`} className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(getFullName(r))}`}>
                      {initials(getFullName(r))}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{getFullName(r)}</p>
                      <p className="text-xs text-black/45">{r.vehicle_label}</p>
                    </div>
                  </Link>
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-black/[0.025] p-3 text-sm text-black/70">
                  <p><span className="text-black/40">CIN</span><br />{r.cin_number}</p>
                  <p><span className="text-black/40">Permis</span><br />{licenseYears(r.license_issue_date)}</p>
                  <p><span className="text-black/40">Du</span><br />{formatDate(r.start_date)}</p>
                  <p><span className="text-black/40">Au</span><br />{formatDate(r.end_date)} ({daysBetween(r.start_date, r.end_date)} j)</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <form key={status} action={updateReservationStatusAction.bind(null, r.id, status)}>
                      <button
                        type="submit"
                        disabled={r.status === status}
                        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/5 disabled:opacity-30"
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    </form>
                  ))}
                  <form action={deleteReservationAction.bind(null, r.id)} className="ml-auto">
                    <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string | number;
  tone: "ink" | "yellow" | "green";
}) {
  const toneMap = {
    ink: { wrap: "border-black/10 bg-white", text: "text-[var(--color-ink)]", icon: "text-black/45" },
    yellow: { wrap: "border-yellow-200 bg-yellow-50", text: "text-yellow-700", icon: "text-yellow-700/70" },
    green: { wrap: "border-green-200 bg-green-50", text: "text-green-700", icon: "text-green-700/70" },
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneMap.wrap}`}>
      <div className={`flex items-center gap-2 ${toneMap.icon}`}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl font-extrabold ${toneMap.text}`}>{value}</p>
    </div>
  );
}