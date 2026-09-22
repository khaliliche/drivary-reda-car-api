import { getVehicles } from "@/lib/db";
import { createWalkInReservationAction } from "@/app/admin/real/actions";
import WalkInReservationForm from "@/components/admin/WalkInReservationForm";

export default async function NewWalkInReservationPage() {
  const vehicles = await getVehicles();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 font-display text-2xl font-extrabold">Nouvelle location (guichet)</h1>
      <WalkInReservationForm action={createWalkInReservationAction} vehicles={vehicles} />
    </main>
  );
}