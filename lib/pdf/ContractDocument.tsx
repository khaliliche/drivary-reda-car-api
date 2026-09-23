﻿import { Fragment } from "react";
import { existsSync } from "fs";
import { join } from "path";
import { Document, Page, View, Text, StyleSheet, Svg, Rect, Circle, Path, Line, Image, Font } from "@react-pdf/renderer";
import type { Reservation, Vehicle } from "@/lib/db";
import { getDailyRate, resolveBilling, DEFAULT_MIN_RENTAL_DAYS } from "@/lib/contract";
import { siteConfig } from "@/lib/site-config";

// Brand colors sampled from the printed Drivary Car contract.
const NAVY = "#0B0A08";
const RED = "#D4A017";
const BLACK = "#000000";

// Arabic labels ("كراء السيارات", "عقد") need a font that ships Arabic
// glyphs — react-pdf's built-in Helvetica does not have them. Worse than
// rendering blank: Helvetica maps those codepoints to whatever fallback
// glyphs it has, producing visible garbage ("*'1'J", "/B9") instead of
// nothing. So when the font isn't available we don't just swap the font
// family — we skip rendering the Arabic <Text> nodes entirely via the
// <Arabic> helper below. react-pdf also only reads the font file lazily
// during render (not at registration time), so this existsSync check is
// the only reliable way to know up front.
// Drop a TTF that covers Arabic (e.g. Noto Sans Arabic) at
// public/fonts/NotoSansArabic-Regular.ttf to turn the Arabic labels on.
const ARABIC_FONT_PATH = join(process.cwd(), "public/fonts/NotoSansArabic-Regular.ttf");
const HAS_ARABIC_FONT = existsSync(ARABIC_FONT_PATH);

if (HAS_ARABIC_FONT) {
  Font.register({
    family: "NotoSansArabic",
    src: ARABIC_FONT_PATH,
  });
}

// Renders Arabic text only once a real Arabic-capable font is registered;
// renders nothing at all otherwise (never falls back to Helvetica for
// Arabic text — see note above).
function Arabic({ style, children }: { style: object; children: string }) {
  if (!HAS_ARABIC_FONT) return null;
  return <Text style={[style, { fontFamily: "NotoSansArabic" }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  page: {
    padding: 22,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: BLACK,
  },

  // ---- Header ----
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  contactBlock: { width: 130 },
  contactText: { fontSize: 9, fontWeight: 700, color: NAVY, marginTop: 2 },
  titleFr: { fontSize: 14, fontWeight: 800, color: NAVY },

  logoBadge: { alignItems: "center", width: 190 },
  logoWordmark: { fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: 0.5, marginTop: 1 },

  titleAr: { fontSize: 15, fontWeight: 800, textAlign: "right" },
  arWrap: { width: 130, alignItems: "flex-end" },

  contractBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1.2 solid " + NAVY,
    borderRadius: 4,
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  contractLabel: { fontSize: 13, fontWeight: 800, color: NAVY },
  contractLabelAr: { fontSize: 13, fontWeight: 800 },
  contractNumber: { fontSize: 15, fontWeight: 800, color: RED },

  // ---- Cards ----
  twoColRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  halfCol: { flex: 1 },
  card: { border: "1.2 solid " + NAVY, borderRadius: 6 },
  cardHeader: {
    backgroundColor: NAVY,
    paddingVertical: 3,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  cardHeaderText: { color: "#fff", fontSize: 8.5, fontWeight: 700, textAlign: "center" },
  cardBody: { padding: 7 },

  fieldRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 5.5 },
  fieldLabel: { fontSize: 7.3, fontWeight: 700, marginRight: 4 },
  fieldValue: {
    flex: 1,
    fontSize: 7.5,
    borderBottomWidth: 0.75,
    borderBottomStyle: "dotted",
    borderBottomColor: "#000",
    paddingBottom: 1,
  },
  fieldValueStrong: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: 700,
    borderBottomWidth: 0.75,
    borderBottomStyle: "dotted",
    borderBottomColor: "#000",
    paddingBottom: 1,
  },

  // ---- Signature strip (1er / autre conducteur) ----
  sigStripRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  sigStripCol: { flex: 1, border: "1.2 solid " + NAVY, borderRadius: 6 },
  sigStripHeader: { paddingVertical: 4, paddingHorizontal: 8 },
  sigStripHeaderText: { fontSize: 8.5, fontWeight: 800, color: NAVY },
  sigStripBody: { height: 40 },
  sigImage: { width: "100%", height: "100%", objectFit: "contain" },

  // ---- Row: Depart/Retour (left) + Vehicule (right) ----
  topLowerRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  depRetGroup: { width: "42%", flexDirection: "row", gap: 6 },
  depRetCol: { flex: 1 },
  vehiculeCol: { flex: 1 },

  // ---- Full-width Facturation / Prolongation (matches the printed layout) ----
  fullWidthCard: { marginBottom: 6 },
  facturationGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 18 },
  facturationField: { width: "31%" },

  // ---- Fuel + damage diagram + visa row ----
  diagramRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  diagramCol: { width: "32%", border: "1.2 solid " + NAVY, borderRadius: 6, padding: 7, alignItems: "center" },
  carbLabel: { fontSize: 8.5, fontWeight: 800, marginTop: 6, marginBottom: 4, alignSelf: "flex-start" },
  carbRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3, alignSelf: "flex-start" },
  carbBox: { width: 9, height: 9, border: "1 solid #000" },
  carbBoxChecked: { backgroundColor: BLACK },
  carbText: { fontSize: 7.5, fontWeight: 700 },

  carDiagramCol: { flex: 1, border: "1.2 solid " + NAVY, borderRadius: 6, alignItems: "center", justifyContent: "center" },

  // ---- Visa / stamp box ----
  visaCol: { flex: 1, border: "1.2 solid " + NAVY, borderRadius: 6, padding: 7 },
  visaLabel: { fontSize: 8, fontWeight: 800, marginBottom: 3 },
  stampWordmark: { fontSize: 10, fontWeight: 800, color: NAVY, fontStyle: "italic" },
  stampLine: { fontSize: 6.8, color: NAVY, fontStyle: "italic" },
  adminSigImage: { width: 90, height: 32, objectFit: "contain", marginTop: 2 },

  // ---- Footer ----
  footer: {
    marginTop: 4,
    borderTop: "0.75 solid " + NAVY,
    paddingTop: 5,
    alignItems: "center",
  },
  footerText: { fontSize: 7.3, fontWeight: 700, color: NAVY },
});

function formatDate(value: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderText}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Field({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={strong ? styles.fieldValueStrong : styles.fieldValue}>{value || " "}</Text>
    </View>
  );
}

// Drawn vector badge approximating the printed crest (arched car
// silhouette + two stars either side + "DRIVARY CAR" wordmark). This is
// a stand-in, not a pixel-accurate reproduction — swap for an <Image>
// with the real logo file once supplied for an exact match.
function LogoBadge() {
  return (
    <View style={styles.logoBadge}>
      <Svg width={110} height={34} viewBox="0 0 150 46">
        {/* car silhouette: low roofline + two wheels, drawn as a single closed path */}
        <Path
          d="M14 34 C14 30 18 27 24 27 L34 27 C37 20 44 15 54 14 L96 14 C106 15 113 20 116 27 L126 27 C132 27 136 30 136 34 L136 36 L14 36 Z"
          stroke={NAVY}
          strokeWidth={2}
          fill="none"
        />
        <Path
          d="M46 27 C49 21 55 17 62 16 L88 16 C93 17 98 20 101 25"
          stroke={NAVY}
          strokeWidth={1.4}
          fill="none"
        />
        <Circle cx={40} cy={36} r={6.5} stroke={NAVY} strokeWidth={2} fill="#fff" />
        <Circle cx={110} cy={36} r={6.5} stroke={NAVY} strokeWidth={2} fill="#fff" />
        {[0, 1].map((i) => (
          <Path
            key={"starL" + i}
            d="M5 8 l1.2 2.6 2.8 0.3 -2.1 2 0.6 2.8 -2.5 -1.4 -2.5 1.4 0.6 -2.8 -2.1 -2 2.8 -0.3 Z"
            fill={NAVY}
            transform={`translate(${i * 9}, 2)`}
          />
        ))}
        {[0, 1].map((i) => (
          <Path
            key={"starR" + i}
            d="M5 8 l1.2 2.6 2.8 0.3 -2.1 2 0.6 2.8 -2.5 -1.4 -2.5 1.4 0.6 -2.8 -2.1 -2 2.8 -0.3 Z"
            fill={NAVY}
            transform={`translate(${127 + i * 9}, 2)`}
          />
        ))}
      </Svg>
      <Text style={styles.logoWordmark}>DRIVARY CAR</Text>
    </View>
  );
}

// Fuel gauge dial: five ticks (0, 1/4, 1/2, 3/4, 1) with a needle
// pointing at the recorded fuel_level_out. Enlarged and spaced further
// out than the first pass, so labels don't collide/get clipped.
function FuelGauge({ level }: { level: number | null }) {
  const cx = 44;
  const cy = 42;
  const r = 30;
  const angleFor = (t: number) => Math.PI - t * Math.PI; // 0 -> left(180deg), 1 -> right(0deg)
  const ticks: { t: number; label: string }[] = [
    { t: 0, label: "0" },
    { t: 0.25, label: "1/4" },
    { t: 0.5, label: "1/2" },
    { t: 0.75, label: "3/4" },
    { t: 1, label: "1" },
  ];
  const needleAngle = angleFor(level ?? 0.5);
  const nx = cx + (r - 8) * Math.cos(needleAngle);
  const ny = cy - (r - 8) * Math.sin(needleAngle);

  return (
    <Svg width={88} height={56} viewBox="0 0 88 56">
      <Path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={NAVY}
        strokeWidth={1.5}
        fill="none"
      />
      {ticks.map(({ t, label }) => {
        const a = angleFor(t);
        const x1 = cx + r * Math.cos(a);
        const y1 = cy - r * Math.sin(a);
        const x2 = cx + (r - 4) * Math.cos(a);
        const y2 = cy - (r - 4) * Math.sin(a);
        const lx = cx + (r + 9) * Math.cos(a);
        const ly = cy - (r + 9) * Math.sin(a);
        const anchor = t === 0 ? "start" : t === 1 ? "end" : "middle";
        return (
          <Fragment key={t}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={NAVY} strokeWidth={1.2} />
            <Text x={lx} y={ly + 2} style={{ fontSize: 6.5 }} textAnchor={anchor}>
              {label}
            </Text>
          </Fragment>
        );
      })}
      {level != null && <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={RED} strokeWidth={1.8} />}
      <Circle cx={cx} cy={cy} r={1.6} fill={RED} />
    </Svg>
  );
}

// Top-down "exploded" vehicle outline used for damage marking on the
// printed contract (front bumper "AV" at top, rear bumper "AR" at
// bottom, wheels splayed to either side). Markers are placed at the
// recorded zone.
const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  Avant: { x: 55, y: 10 },
  Arrière: { x: 55, y: 122 },
  "Côté gauche": { x: 10, y: 66 },
  "Côté droit": { x: 100, y: 66 },
  Toit: { x: 55, y: 66 },
  "Pare-brise": { x: 55, y: 30 },
  Intérieur: { x: 55, y: 66 },
  Jantes: { x: 28, y: 40 },
};

function symbolFor(type: string) {
  if (type === "Éraflure") return "/";
  if (type === "Bosse") return "X";
  if (type === "Manque") return "O";
  return "?";
}

function CarDiagram({ damages }: { damages: { zone: string; type: string }[] }) {
  return (
    <Svg width={100} height={132} viewBox="0 0 110 140">
      <Text x={55} y={9} style={{ fontSize: 8, fontWeight: 700 }} textAnchor="middle">AV</Text>
      <Rect x={28} y={14} width={54} height={112} rx={20} fill="#fafafa" stroke={NAVY} strokeWidth={1.1} />
      <Rect x={33} y={26} width={44} height={18} rx={5} fill="#fff" stroke="#bbb" strokeWidth={0.6} />
      <Rect x={33} y={96} width={44} height={18} rx={5} fill="#fff" stroke="#bbb" strokeWidth={0.6} />
      {/* wheels splayed outward, connected by a short tick to the body */}
      <Line x1={20} y1={34} x2={28} y2={34} stroke="#666" strokeWidth={1} />
      <Rect x={8} y={26} width={12} height={20} rx={3} fill="#666" />
      <Line x1={82} y1={34} x2={90} y2={34} stroke="#666" strokeWidth={1} />
      <Rect x={90} y={26} width={12} height={20} rx={3} fill="#666" />
      <Line x1={20} y1={106} x2={28} y2={106} stroke="#666" strokeWidth={1} />
      <Rect x={8} y={94} width={12} height={20} rx={3} fill="#666" />
      <Line x1={82} y1={106} x2={90} y2={106} stroke="#666" strokeWidth={1} />
      <Rect x={90} y={94} width={12} height={20} rx={3} fill="#666" />
      <Text x={55} y={135} style={{ fontSize: 8, fontWeight: 700 }} textAnchor="middle">AR</Text>
      {damages.map((d, i) => {
        const pos = ZONE_POSITIONS[d.zone];
        if (!pos) return null;
        return (
          <Text key={i} x={pos.x} y={pos.y + 20} style={{ fontSize: 10, fontWeight: 700 }} textAnchor="middle">
            {symbolFor(d.type)}
          </Text>
        );
      })}
    </Svg>
  );
}

export function ContractDocument({
  reservation,
  vehicle,
}: {
  reservation: Reservation;
  vehicle: Vehicle | null;
}) {
  const vehiclePricing = {
    price_per_day: vehicle?.price_per_day ?? 0,
    price_extended_15: vehicle?.price_extended_15 ?? vehicle?.price_per_day ?? 0,
    price_monthly_30: vehicle?.price_monthly_30 ?? vehicle?.price_per_day ?? 0,
    min_rental_days: vehicle?.min_rental_days ?? DEFAULT_MIN_RENTAL_DAYS,
  };
  const billing = resolveBilling(vehiclePricing, reservation);
  const dailyRate = getDailyRate(vehiclePricing, billing.days);
  const contractNumber = reservation.contract_number ?? "";

  return (
    <Document title={`Contrat de location ${contractNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.contactBlock}>
            <Text style={styles.titleFr}>Location de voiture</Text>
            <Text style={styles.contactText}>{siteConfig.contractPhone}</Text>
          </View>
          <LogoBadge />
          <View style={styles.arWrap}>
            <Arabic style={styles.titleAr}>كراء السيارات</Arabic>
          </View>
        </View>

        <View style={styles.contractBox}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.contractLabel}>CONTRAT</Text>
            <Arabic style={styles.contractLabelAr}>عقد</Arabic>
          </View>
          <Text style={styles.contractNumber}>{contractNumber}</Text>
        </View>

        {/* Driver info */}
        <View style={styles.twoColRow}>
          <View style={styles.halfCol}>
            <Card title="Premier Conducteur">
              <Field label="PRÉNOM :" value={reservation.prenom} />
              <Field label="NOM :" value={reservation.nom} />
              <Field label="C.I.N. :" value={reservation.cin_number} />
              <Field label="Délivré le :" value={formatDate(reservation.cin_delivered_le)} />
              <Field label="Date de Naissance :" value={formatDate(reservation.date_naissance)} />
              <Field label="Permis de conduire N° :" value={reservation.driver_license_number} />
              <Field label="Délivré le :" value={formatDate(reservation.license_issue_date)} />
              <Field label="ADRESSE AU MAROC :" value={reservation.driver_address} />
              <Field label="TÉL :" value={reservation.driver_phone} />
              <Field label="Passeport N° :" value={reservation.driver_passport_number} />
              <Field label="Délivré le :" value={formatDate(reservation.passport_delivered_le)} />
            </Card>
          </View>
          <View style={styles.halfCol}>
            <Card title="autres Conducteurs">
              <Field label="PRÉNOM :" value={reservation.has_second_driver ? reservation.second_driver_prenom : ""} />
              <Field label="NOM :" value={reservation.has_second_driver ? reservation.second_driver_nom : ""} />
              <Field label="C.I.N. :" value={reservation.has_second_driver ? reservation.second_driver_cin_number : ""} />
              <Field label="Délivré le :" value={reservation.has_second_driver ? formatDate(reservation.second_driver_cin_delivered_le) : ""} />
              <Field label="Date de Naissance :" value={reservation.has_second_driver ? formatDate(reservation.second_driver_date_naissance) : ""} />
              <Field label="Permis de conduire N° :" value={reservation.has_second_driver ? reservation.second_driver_license_number : ""} />
              <Field label="Délivré le :" value="" />
              <Field label="ADRESSE AU MAROC :" value={reservation.has_second_driver ? reservation.second_driver_address : ""} />
              <Field label="TÉL :" value={reservation.has_second_driver ? reservation.second_driver_phone : ""} />
              <Field label="Passeport N° :" value={reservation.has_second_driver ? reservation.second_driver_passport_number : ""} />
              <Field label="Délivré le :" value={reservation.has_second_driver ? formatDate(reservation.second_driver_passport_delivered_le) : ""} />
            </Card>
          </View>
        </View>

        {/* Signatures 1er / autre conducteur */}
        <View style={styles.sigStripRow}>
          <View style={styles.sigStripCol}>
            <View style={styles.sigStripHeader}>
              <Text style={styles.sigStripHeaderText}>Signature 1{"\n"}Conducteur</Text>
            </View>
            <View style={styles.sigStripBody}>
              {reservation.signature_data ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={reservation.signature_data} style={styles.sigImage} />
              ) : null}
            </View>
          </View>
          <View style={styles.sigStripCol}>
            <View style={styles.sigStripHeader}>
              <Text style={styles.sigStripHeaderText}>Signature</Text>
            </View>
            <View style={styles.sigStripBody}>
              {reservation.signature_2_data ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={reservation.signature_2_data} style={styles.sigImage} />
              ) : null}
            </View>
          </View>
        </View>

        {/* Depart/Retour (left) + Vehicule (right) */}
        <View style={styles.topLowerRow}>
          <View style={styles.depRetGroup}>
            <View style={styles.depRetCol}>
              <Card title="DEPART">
                <Field label="Le :" value={formatDate(reservation.start_date)} />
                <Field label="Hr :" value={reservation.start_time} />
                <Field label="Lieu de livraison :" value={reservation.lieu_livraison_depart} />
              </Card>
            </View>
            <View style={styles.depRetCol}>
              <Card title="RETOUR">
                <Field label="Le :" value={formatDate(reservation.end_date)} />
                <Field label="Hr :" value={reservation.end_time} />
                <Field label="Lieu de livraison :" value={reservation.lieu_livraison_retour} />
              </Card>
            </View>
          </View>
          <View style={styles.vehiculeCol}>
            <Card title="Véhicule">
              <Field label="Type de véhicule :" value={vehicle ? `${vehicle.brand} ${vehicle.model}` : reservation.vehicle_label} />
              <Field label="Matricule :" value={reservation.registration_plate} />
            </Card>
          </View>
        </View>

        {/* Facturation — full width, matches the printed layout */}
        <View style={styles.fullWidthCard}>
          <Card title="Facturation">
            <View style={styles.facturationGrid}>
              <View style={styles.facturationField}><Field label="Nombre de jours :" value={`${billing.days}`} /></View>
              <View style={styles.facturationField}><Field label="Prix par jours :" value={`${dailyRate.toFixed(2)} DH`} /></View>
              <View style={styles.facturationField}><Field label="Total TTC :" value={`${billing.totalTTC.toFixed(2)} DH`} strong /></View>
              <View style={styles.facturationField}><Field label="Avance :" value={`${billing.avance.toFixed(2)} DH`} /></View>
              <View style={styles.facturationField}><Field label="Reste à payer :" value={`${billing.resteAPayer.toFixed(2)} DH`} strong /></View>
            </View>
          </Card>
        </View>

        {/* Prolongation — full width, matches the printed layout */}
        <View style={styles.fullWidthCard}>
          <Card title="Prolongation">
            <View style={styles.facturationGrid}>
              <View style={styles.facturationField}><Field label="Prolongation :" value={reservation.prolongation} /></View>
              <View style={{ width: "62%" }}>
                <Field
                  label="Retour Prévu le :"
                  value={
                    reservation.retour_prevu_le
                      ? `${formatDate(reservation.retour_prevu_le)} à ${new Date(reservation.retour_prevu_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : ""
                  }
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Fuel gauge + damage diagram + Visa Direction */}
        <View style={styles.diagramRow}>
          <View style={styles.diagramCol}>
            <FuelGauge level={reservation.fuel_level_out} />
            <Text style={styles.carbLabel}>CARBURANT :</Text>
            <View style={styles.carbRow}>
              <View style={[styles.carbBox, ...(reservation.fuel_type === "super_sans_plomb" ? [styles.carbBoxChecked] : [])]} />
              <Text style={styles.carbText}>SUPER SANS PLOMB</Text>
            </View>
            <View style={styles.carbRow}>
              <View style={[styles.carbBox, ...(reservation.fuel_type === "gasoil" ? [styles.carbBoxChecked] : [])]} />
              <Text style={styles.carbText}>GASOIL</Text>
            </View>
          </View>
          <View style={styles.carDiagramCol}>
            <CarDiagram damages={reservation.damages} />
          </View>
          <View style={styles.visaCol}>
            <Text style={styles.visaLabel}>Visa Direction :</Text>
            {reservation.admin_signature_data ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={reservation.admin_signature_data} style={styles.adminSigImage} />
            ) : null}
            <Text style={styles.stampWordmark}>DRIVARY CAR</Text>
            <Text style={styles.stampLine}>ICE: {siteConfig.ice}</Text>
            <Text style={styles.stampLine}>GSM: {siteConfig.stampPhone}</Text>
            <Text style={styles.stampLine}>Location de voiture</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{siteConfig.address}</Text>
          <Text style={styles.footerText}>{siteConfig.email}   Gsm : {siteConfig.footerPhone}</Text>
        </View>
      </Page>
    </Document>
  );
}
