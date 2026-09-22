"use client";

import { useState } from "react";
import { DAMAGE_ZONES, DAMAGE_TYPES, EQUIPMENT_ITEMS, FUEL_TYPES, FUEL_LEVELS } from "@/lib/contract";
import type { DamageEntry, EquipmentChecklist } from "@/lib/db";

export default function HandoverForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void;
  initial: {
    registration_plate: string;
    mileage_start: number | null;
    mileage_end: number | null;
    damages: DamageEntry[];
    equipment: EquipmentChecklist;
    fuel_type: string;
    fuel_level_out: number | null;
    fuel_level_in: number | null;
    delivery_fee: number;
    pickup_fee: number;
  };
}) {
  const [damages, setDamages] = useState<DamageEntry[]>(initial.damages);
  const [fuelType, setFuelType] = useState(initial.fuel_type || FUEL_TYPES[0].value);
  const [fuelOut, setFuelOut] = useState<number | null>(initial.fuel_level_out);
  const [fuelIn, setFuelIn] = useState<number | null>(initial.fuel_level_in);

  function addDamage() {
    setDamages((d) => [...d, { zone: DAMAGE_ZONES[0], type: DAMAGE_TYPES[0].value, note: "" }]);
  }
  function removeDamage(index: number) {
    setDamages((d) => d.filter((_, i) => i !== index));
  }
  function updateDamage(index: number, patch: Partial<DamageEntry>) {
    setDamages((d) => d.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function fuelLabel(level: number) {
    if (level === 0) return "0";
    if (level === 1) return "1";
    return `${level * 4}/4`;
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="damages_json" value={JSON.stringify(damages)} readOnly />
      <input type="hidden" name="fuel_type" value={fuelType} readOnly />
      <input type="hidden" name="fuel_level_out" value={fuelOut ?? ""} readOnly />
      <input type="hidden" name="fuel_level_in" value={fuelIn ?? ""} readOnly />

      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-sm font-semibold">Immatriculation</span>
        <input
          type="text"
          name="registration_plate"
          defaultValue={initial.registration_plate}
          className="rounded-lg border border-black/15 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Km départ</span>
          <input
            type="number"
            name="mileage_start"
            defaultValue={initial.mileage_start ?? ""}
            className="rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Km retour</span>
          <input
            type="number"
            name="mileage_end"
            defaultValue={initial.mileage_end ?? ""}
            className="rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-sm font-semibold">Carburant</span>
        <select
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
          className="rounded-lg border border-black/15 px-3 py-2"
        >
          {FUEL_TYPES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="text-sm font-semibold">Niveau au départ</span>
          <div className="mt-2 flex gap-2">
            {FUEL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFuelOut(level)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  fuelOut === level
                    ? "border-[var(--color-red-primary)] bg-[var(--color-red-primary)] text-white"
                    : "border-black/15 hover:bg-black/5"
                }`}
              >
                {fuelLabel(level)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-sm font-semibold">Niveau au retour</span>
          <div className="mt-2 flex gap-2">
            {FUEL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFuelIn(level)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  fuelIn === level
                    ? "border-[var(--color-red-primary)] bg-[var(--color-red-primary)] text-white"
                    : "border-black/15 hover:bg-black/5"
                }`}
              >
                {fuelLabel(level)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Frais de livraison (DH)</span>
          <input
            type="number"
            step="0.01"
            name="delivery_fee"
            defaultValue={initial.delivery_fee}
            className="rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Frais de reprise (DH)</span>
          <input
            type="number"
            step="0.01"
            name="pickup_fee"
            defaultValue={initial.pickup_fee}
            className="rounded-lg border border-black/15 px-3 py-2"
          />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Dommages constatés</span>
          <button
            type="button"
            onClick={addDamage}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
          >
            + Ajouter
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {damages.length === 0 && (
            <p className="text-sm text-black/40">Aucun dommage constaté.</p>
          )}
          {damages.map((d, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
            >
              <select
                value={d.zone}
                onChange={(e) => updateDamage(i, { zone: e.target.value })}
                className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
              >
                {DAMAGE_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <select
                value={d.type}
                onChange={(e) => updateDamage(i, { type: e.target.value })}
                className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
              >
                {DAMAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value} ({t.symbol})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Note"
                value={d.note}
                onChange={(e) => updateDamage(i, { note: e.target.value })}
                className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeDamage(i)}
                className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm font-semibold">Équipement fourni</span>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EQUIPMENT_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`equipment__${item.key}`}
                defaultChecked={Boolean(initial.equipment[item.key])}
                className="h-4 w-4 rounded border-black/25"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-fit rounded-lg bg-[var(--color-red-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
      >
        Enregistrer
      </button>
    </form>
  );
}
