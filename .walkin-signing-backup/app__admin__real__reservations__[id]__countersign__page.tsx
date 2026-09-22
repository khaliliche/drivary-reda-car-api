import { notFound } from "next/navigation";
import { getReservationById } from "@/lib/db";
import { getFullName } from "@/lib/contract";
import AdminCountersignForm from "@/components/admin/AdminCountersignForm";

export default async function CountersignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getReservationById(Number(id));
  if (!reservation) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-extrabold">Contresignature agence</h1>
        <p className="mb-6 text-center text-sm text-black/50">
          {reservation.vehicle_label} - {getFullName(reservation)}
        </p>
        <AdminCountersignForm reservationId={reservation.id} />
      </div>
    </main>
  );
}