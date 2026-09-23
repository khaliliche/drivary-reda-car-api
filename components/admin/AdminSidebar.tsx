import Link from "next/link";
import { Car, CalendarClock, Users, FileText, LogOut, MessageCircle } from "lucide-react";
import { logoutAction } from "@/app/admin/real/actions";
import { buildWhatsAppLink } from "@/lib/site-config";

const NAV = [
  { key: "vehicules", href: "/admin/real", label: "Véhicules", icon: Car },
  { key: "reservations", href: "/admin/real/reservations", label: "Réservations", icon: CalendarClock },
  { key: "contracts", href: "/admin/real/contracts", label: "Contrats", icon: FileText },
  { key: "clients", href: "/admin/real/clients", label: "Clients", icon: Users },
] as const;

export default function AdminSidebar({
  active,
}: {
  active: "vehicules" | "reservations" | "contracts" | "clients";
}) {
  const whatsappHref = buildWhatsAppLink(
    "Bonjour, j'ai besoin d'aide sur l'espace admin."
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-[var(--color-charcoal)] px-4 py-6 lg:flex">
        <Link href="/admin/real" className="mb-8 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/drivary-car-logo.png"
            alt="Drivary Car"
            className="h-9 w-9 rounded-lg object-cover"
          />

          <div className="leading-tight">
            <p className="font-display text-sm font-extrabold text-white">
              Drivary Car
            </p>
            <p className="text-[11px] text-white/40">Espace admin</p>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ key, href, label, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active === key
                  ? "bg-[var(--color-red-primary)] text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {label}
            </Link>
          ))}
        </nav>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Besoin d&apos;aide
        </a>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </form>
      </aside>

      <div className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-black/10 bg-[var(--color-charcoal)] px-3 py-2.5 lg:hidden">
        {NAV.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              active === key
                ? "bg-[var(--color-red-primary)] text-white"
                : "bg-white/5 text-white/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}

        <form action={logoutAction} className="ml-auto shrink-0">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/60"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}



