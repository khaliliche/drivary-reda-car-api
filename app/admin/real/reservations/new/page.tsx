import { getVehicles } from "@/lib/db";
import { createWalkInReservationAction } from "@/app/admin/real/actions";
import WalkInReservationForm from "@/components/admin/WalkInReservationForm";

export default async function NewWalkInReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const vehicles = await getVehicles();
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 font-display text-2xl font-extrabold">Nouvelle location (guichet)</h1>

      {error === "vehicle" && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Véhicule introuvable. Merci de le sélectionner à nouveau.
        </p>
      )}
      {error === "dates" && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          La date de retour doit être après la date de départ.
        </p>
      )}
      {error === "conflict" && (
        <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Ce véhicule a déjà une réservation confirmée qui chevauche ces dates.
        </p>
      )}

      <WalkInReservationForm action={createWalkInReservationAction} vehicles={vehicles} />
    </main>
  );
}