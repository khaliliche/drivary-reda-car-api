"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import { submitSignatureAction } from "@/app/sign/[token]/actions";

type Summary = {
  vehicleLabel: string;
  fullName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export default function SignatureForm({ token, summary }: { token: string; summary: Summary }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitSignatureAction.bind(null, token),
    { ok: false, error: "" }
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      penColor: "rgb(15, 23, 42)",
      minWidth: 1,
      maxWidth: 2.5,
    });
    padRef.current = pad;

    return () => {
      pad.off();
    };
  }, []);

  // Walk-in flow: once the server says every required signature is in,
  // hop straight to the admin countersign screen on this same device.
  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.replace(state.redirectTo);
    }
  }, [state.ok, state.redirectTo, router]);

  function handleSubmit(formData: FormData) {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      return; // blocked client-side; the server validates too
    }
    formData.set("signature", pad.toDataURL("image/png"));
    formAction(formData);
  }

  if (state.ok && !state.redirectTo) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-bold text-emerald-700">Contrat signe !</p>
        <p className="mt-2 text-sm text-emerald-700/80">
          Merci {summary.fullName}. Presentez-vous le jour de la remise avec
          votre CIN et votre permis de conduire.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {/* honeypot */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
        <p className="font-semibold text-black">{summary.vehicleLabel}</p>
        <p className="mt-1">
          Du {summary.startDate} a {summary.startTime} au {summary.endDate} a{" "}
          {summary.endTime}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-black/80">
        Nom complet
        <input
          type="text"
          name="signer_name"
          required
          defaultValue={summary.fullName}
          className="rounded-lg border border-black/15 px-3 py-2 text-base"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-black/80">Signature</span>
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

      <label className="flex items-start gap-2 text-sm text-black/70">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>J ai lu et j accepte les conditions generales de location.</span>
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || !accepted}
        className="rounded-xl bg-black py-3 text-sm font-bold text-white transition-colors hover:bg-black/80 disabled:opacity-40"
      >
        {pending ? "Envoi..." : "Signer le contrat"}
      </button>
    </form>
  );
}