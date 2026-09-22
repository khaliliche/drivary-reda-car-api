import { getReservationBySigningToken, isSecondDriverToken } from "@/lib/db";
import { getFullName } from "@/lib/contract";
import SignatureForm from "@/components/sign/SignatureForm";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-2 text-sm text-black/60">{body}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservation = await getReservationBySigningToken(token);

  if (!reservation) {
    return (
      <Shell>
        <Message title="Lien invalide" body="Ce lien de signature est invalide ou a deja ete utilise." />
      </Shell>
    );
  }
  if (reservation.status === "cancelled") {
    return (
      <Shell>
        <Message title="Reservation annulee" body="Cette reservation a ete annulee. Contactez l agence." />
      </Shell>
    );
  }

  // A reservation can have two independent links: the main driver's and,
  // if there's a second driver, theirs. Figure out which one this is so we
  // check the right "already signed"/"expired" state and show the right name.
  const isSecondDriver = isSecondDriverToken(reservation, token);
  const alreadySigned = isSecondDriver ? reservation.signed_2_at : reservation.signed_at;
  const tokenExpiresAt = isSecondDriver
    ? reservation.signing_token_2_expires_at
    : reservation.signing_token_expires_at;
  const displayName = isSecondDriver
    ? getFullName({ prenom: reservation.second_driver_prenom, nom: reservation.second_driver_nom })
    : getFullName(reservation);

  if (alreadySigned) {
    return (
      <Shell>
        <Message title="Contrat deja signe" body="Ce contrat a deja ete signe. Merci !" />
      </Shell>
    );
  }
  if (tokenExpiresAt && new Date(tokenExpiresAt) < new Date()) {
    return (
      <Shell>
        <Message title="Lien expire" body="Ce lien a expire. Contactez l agence pour en recevoir un nouveau." />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-center font-display text-2xl font-extrabold text-[var(--color-ink)]">
        Ahmed Red Car
      </h1>
      <p className="mb-6 text-center text-sm text-black/50">
        Contrat de location - signature electronique
        {isSecondDriver ? " (deuxieme conducteur)" : ""}
      </p>
      <SignatureForm
        token={token}
        summary={{
          vehicleLabel: reservation.vehicle_label,
          fullName: displayName,
          startDate: formatDate(reservation.start_date),
          endDate: formatDate(reservation.end_date),
          startTime: reservation.start_time,
          endTime: reservation.end_time,
        }}
      />
    </Shell>
  );
}