"use client";

import { useState } from "react";
import type { Vehicle } from "@/lib/db";

const inputClass = "rounded-lg border border-black/15 px-3 py-2 text-sm";
const labelClass = "flex flex-col gap-1";
const spanClass = "text-sm font-semibold";

export default function WalkInReservationForm({
  action,
  vehicles,
}: {
  action: (formData: FormData) => void;
  vehicles: Vehicle[];
}) {
  const [hasSecondDriver, setHasSecondDriver] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-8">
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
          Vehicule &amp; periode
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={spanClass}>Vehicule</span>
            <select name="vehicle_id" className={inputClass} required defaultValue="">
              <option value="" disabled>
                Choisir un vehicule
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} — {v.price_per_day} DH/j
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Fait a (ville)</span>
            <input type="text" name="fait_a" className={inputClass} placeholder="Ex. Agadir" />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Date depart</span>
            <input type="date" name="start_date" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Heure depart</span>
            <input type="time" name="start_time" defaultValue="10:00" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Date retour</span>
            <input type="date" name="end_date" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Heure retour</span>
            <input type="time" name="end_time" defaultValue="10:00" className={inputClass} required />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
          Conducteur
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={spanClass}>Prenom</span>
            <input type="text" name="prenom" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Nom</span>
            <input type="text" name="nom" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Date de naissance</span>
            <input type="date" name="date_naissance" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>N&deg; C.I.N</span>
            <input type="text" name="cin_number" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Permis obtenu le</span>
            <input type="date" name="license_issue_date" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>N&deg; permis</span>
            <input type="text" name="driver_license_number" className={inputClass} required />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>N&deg; passeport</span>
            <input type="text" name="driver_passport_number" className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={spanClass}>Telephone</span>
            <input type="text" name="driver_phone" className={inputClass} required />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={spanClass}>Adresse</span>
            <input type="text" name="driver_address" className={inputClass} required />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-black/50">
            Autre conducteur
          </h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="has_second_driver"
              checked={hasSecondDriver}
              onChange={(e) => setHasSecondDriver(e.target.checked)}
              className="h-4 w-4 rounded border-black/25"
            />
            Present
          </label>
        </div>
        {hasSecondDriver && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              <span className={spanClass}>Prenom</span>
              <input type="text" name="second_driver_prenom" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Nom</span>
              <input type="text" name="second_driver_nom" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>N&deg; C.I.N</span>
              <input type="text" name="second_driver_cin_number" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>N&deg; permis</span>
              <input type="text" name="second_driver_license_number" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>N&deg; passeport</span>
              <input type="text" name="second_driver_passport_number" className={inputClass} />
            </label>
            <label className={labelClass}>
              <span className={spanClass}>Telephone</span>
              <input type="text" name="second_driver_phone" className={inputClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              <span className={spanClass}>Adresse</span>
              <input type="text" name="second_driver_address" className={inputClass} />
            </label>
          </div>
        )}
      </section>

      <button
        type="submit"
        className="self-start rounded-lg bg-[var(--color-red-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
      >
        Creer la location
      </button>
    </form>
  );
}