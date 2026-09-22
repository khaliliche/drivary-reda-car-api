"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import { recordAdminSignatureFormAction } from "@/app/admin/real/actions";

export default function AdminCountersignForm({ reservationId }: { reservationId: number }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [state, formAction, pending] = useActionState(
    recordAdminSignatureFormAction.bind(null, reservationId),
    { ok: false, error: "" }
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: "rgb(15, 23, 42)" });
    return () => padRef.current?.off();
  }, []);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => router.push(`/admin/real/reservations/${reservationId}`), 1500);
      return () => clearTimeout(t);
    }
  }, [state.ok, reservationId, router]);

  function handleSubmit(formData: FormData) {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    formData.set("admin_signature_data", pad.toDataURL("image/png"));
    formAction(formData);
  }

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-bold text-emerald-700">Contrat finalise</p>
        <p className="mt-2 text-sm text-emerald-700/80">Retour au tableau de bord...</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-black/80">
        Nom de l&apos;agent
        <input
          type="text"
          name="admin_signer_name"
          required
          className="rounded-lg border border-black/15 px-3 py-2 text-base"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-black/80">Signature (agence)</span>
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white">
          <canvas ref={canvasRef} className="h-44 w-full touch-none" />
        </div>
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          className="self-end text-xs font-semibold text-black/50 underline"
        >
          Effacer
        </button>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-black py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "Envoi..." : "Valider et finaliser le contrat"}
      </button>
    </form>
  );
}