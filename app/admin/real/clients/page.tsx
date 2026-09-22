import { getReservations } from "@/lib/db";
import { getFullName, calculateAge } from "@/lib/contract";
import { Users, Repeat, IdCard } from "lucide-react";
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
const AVATAR_COLORS = [
  "bg-[var(--color-red-primary)]",
  "bg-[var(--color-brass)]",
  "bg-[var(--color-clay)]",
  "bg-[var(--color-ink)]",
];

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

export default async function AdminClientsPage() {
  const reservations = await getReservations();

  // Group reservations by CIN number = one client, one record per unique person.
  type ClientRecord = {
    cin_number: string;
    full_name: string;
    age: number;
    license_issue_date: string;
    bookings: typeof reservations;
  };

  const byCin = new Map<string, ClientRecord>();

  for (const r of reservations) {
    const existing = byCin.get(r.cin_number);
    if (existing) {
      existing.bookings.push(r);
      // Keep the most recent name/age/license info (reservations are already
      // ordered by created_at DESC, so the first one seen per CIN is latest).
    } else {
      byCin.set(r.cin_number, {
        cin_number: r.cin_number,
        full_name: getFullName(r),
        age: calculateAge(r.date_naissance),
        license_issue_date: r.license_issue_date,
        bookings: [r],
      });
    }
  }

  const clients = Array.from(byCin.values()).sort(
    (a, b) => b.bookings.length - a.bookings.length
  );

  const repeatClients = clients.filter((c) => c.bookings.length > 1).length;
  const confirmedClients = clients.filter((c) =>
    c.bookings.some((b) => b.status === "confirmed")
  ).length;

  return (
    <div className="min-h-screen bg-[var(--color-mist)]/40 lg:flex">
      <AdminSidebar active="clients" />

      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
              Clients
            </h1>
            <p className="mt-1 text-sm text-black/50">
              Basé sur les réservations reçues — chaque client est identifié par son CIN.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label="Clients" value={clients.length} tone="ink" />
            <StatCard icon={Repeat} label="Clients fidèles" value={repeatClients} tone="green" />
            <StatCard
              icon={IdCard}
              label="Avec réservation confirmée"
              value={confirmedClients}
              tone="ink"
              wide
            />
          </div>

          {/* Client list */}
          <div className="mt-8 flex flex-col gap-3">
            {clients.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/15 p-8 text-center text-black/50">
                Aucun client pour le moment.
              </p>
            )}

            {clients.map((client) => (
              <div
                key={client.cin_number}
                className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(
                        client.full_name
                      )}`}
                    >
                      {initials(client.full_name)}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {client.full_name}{" "}
                        <span className="font-normal text-black/40">· {client.age} ans</span>
                      </p>
                      <p className="text-sm text-black/50">
                        CIN {client.cin_number} · Permis {licenseYears(client.license_issue_date)}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/60">
                    {client.bookings.length} réservation{client.bookings.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-1.5 border-t border-black/5 pt-3">
                  {client.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm text-black/70"
                    >
                      <span>
                        {b.vehicle_label} · {formatDate(b.start_date)} → {formatDate(b.end_date)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-black/50">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[b.status]}`} />
                        {STATUS_LABELS[b.status]}
                      </span>
                    </div>
                  ))}
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
  wide,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone: "ink" | "green";
  wide?: boolean;
}) {
  const toneClasses =
    tone === "green"
      ? { wrap: "border-green-200 bg-green-50", text: "text-green-700", icon: "text-green-700/70" }
      : { wrap: "border-black/10 bg-white", text: "text-[var(--color-ink)]", icon: "text-black/45" };

  return (
    <div className={`rounded-2xl border p-5 ${toneClasses.wrap} ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <div className={`flex items-center gap-2 ${toneClasses.icon}`}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 font-display text-3xl font-extrabold ${toneClasses.text}`}>{value}</p>
    </div>
  );
}