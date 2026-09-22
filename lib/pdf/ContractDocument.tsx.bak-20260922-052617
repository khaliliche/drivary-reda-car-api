import { readFileSync } from "fs";
import { join } from "path";
import { Document, Page, View, Text, Image, StyleSheet, Svg, Rect } from "@react-pdf/renderer";
import type { Reservation, Vehicle } from "@/lib/db";
import { DAMAGE_TYPES, EQUIPMENT_ITEMS, resolveBilling, getFullName, DEFAULT_MIN_RENTAL_DAYS } from "@/lib/contract";

const BLACK = "#000000";

// Read the real logo once per server invocation and inline it as a data URI
// so react-pdf doesn't need to resolve a filesystem path at render time.
const LOGO_SRC = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/logo.png")
).toString("base64")}`;

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: BLACK,
  },

  // ---- Header ----
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logoImage: { width: 130, height: 48, objectFit: "contain" },
  title: { flex: 1, fontSize: 21, fontWeight: 800, textAlign: "left", marginLeft: 16 },

  // ---- Cards ----
  twoColRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  halfCol: { flex: 1 },
  card: { border: "1.4 solid #000", borderRadius: 8 },
  cardHeader: {
    backgroundColor: BLACK,
    paddingVertical: 3.5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  cardHeaderText: {
    color: "#fff",
    fontSize: 8.5,
    fontWeight: 700,
    textAlign: "center",
  },
  cardBody: { padding: 8 },

  fieldRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6.5 },
  fieldLabel: { fontSize: 7.5, fontWeight: 700, marginRight: 4 },
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

  // ---- Row 3: validation + damages ----
  row3: { flexDirection: "row", gap: 10, marginBottom: 10 },
  validationCol: { width: "34%" },
  damagesCol: { flex: 1 },
  damagesBody: { flexDirection: "row", gap: 10 },
  legendCol: { width: 78 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  legendSymbol: { width: 12, fontSize: 9, fontWeight: 700, textAlign: "center" },
  legendLabel: { fontSize: 7 },
  legendCount: { fontSize: 6.5, color: "#555", marginTop: 6 },
  carWrap: { flex: 1, alignItems: "center" },
  fuelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  fuelLabel: { fontSize: 6.5, marginRight: 2 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  checkbox: { width: 7, height: 7, border: "1 solid #000" },
  checkboxLabel: { fontSize: 7 },

  // ---- Row 4: equipment + signatures ----
  row4: { flexDirection: "row", gap: 10, marginBottom: 10 },
  equipCol: { flex: 1 },
  equipGrid: { flexDirection: "row", flexWrap: "wrap" },
  equipItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  equipCheckbox: { width: 7, height: 7, border: "1 solid #000", marginRight: 4 },
  equipCheckboxChecked: { backgroundColor: BLACK },
  equipLabel: { fontSize: 7 },

  sigCol: { width: "40%" },
  nbText: { fontSize: 6.5, lineHeight: 1.4, color: "#222" },
  nbLabel: { fontSize: 7.5, fontWeight: 700, marginBottom: 3 },

  // ---- Signature strip ----
  sigStripRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  sigStripCol: { flex: 1, border: "1.4 solid #000", borderRadius: 8 },
  sigStripHeader: {
    backgroundColor: BLACK,
    paddingVertical: 3,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  sigStripHeaderText: { color: "#fff", fontSize: 7.5, fontWeight: 700, textAlign: "center" },
  sigStripBody: { height: 46 },
  sigImage: { width: "100%", height: "100%", objectFit: "contain" },
  auditLine: { fontSize: 6.5, color: "#333", marginBottom: 4 },

  // ---- Footer ----
  footer: {
    position: "absolute",
    bottom: 18,
    left: 26,
    right: 26,
    borderTop: "0.75 solid #999",
    paddingTop: 6,
  },
  footerRow: { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 2 },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  footerText: { fontSize: 7, fontWeight: 600 },
  footerAddressRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, marginBottom: 2 },
  footerAddressText: { fontSize: 6.5, color: "#333" },
  footerRcText: { fontSize: 6.5, color: "#333", textAlign: "center" },
});

function formatDate(value: string | Date) {
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

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={strong ? styles.fieldValueStrong : styles.fieldValue}>{value || " "}</Text>
    </View>
  );
}

// Real "AR CARS" logo, read from /public/logo.png.
function LogoBadge() {
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={LOGO_SRC} style={styles.logoImage} />;
}

// Simplified top-down car outline used as the damage diagram. Markers use
// the same symbols as the printed legend (/ Éraflure, X Bosse, O Manque)
// placed at the approximate zone reported by the admin.
const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  Avant: { x: 55, y: 13 },
  Arrière: { x: 55, y: 139 },
  "Côté gauche": { x: 16, y: 76 },
  "Côté droit": { x: 94, y: 76 },
  Toit: { x: 55, y: 70 },
  "Pare-brise": { x: 55, y: 30 },
  Intérieur: { x: 55, y: 82 },
  Jantes: { x: 30, y: 40 },
};

function symbolFor(type: string) {
  return DAMAGE_TYPES.find((t) => t.value === type)?.symbol ?? "?";
}

function CarDiagram({ damages }: { damages: { zone: string; type: string }[] }) {
  return (
    <Svg width={120} height={152} viewBox="0 0 120 152">
      {/* body */}
      <Rect x={26} y={8} width={58} height={136} rx={18} fill="#fafafa" stroke="#333" strokeWidth={1.1} />
      {/* windshield / rear window */}
      <Rect x={33} y={22} width={44} height={20} rx={5} fill="#fff" stroke="#bbb" strokeWidth={0.6} />
      <Rect x={33} y={108} width={44} height={20} rx={5} fill="#fff" stroke="#bbb" strokeWidth={0.6} />
      {/* roof line */}
      <Rect x={30} y={46} width={50} height={58} rx={8} fill="none" stroke="#ccc" strokeWidth={0.6} />
      {/* wheels */}
      <Rect x={20} y={32} width={7} height={16} rx={2} fill="#666" />
      <Rect x={83} y={32} width={7} height={16} rx={2} fill="#666" />
      <Rect x={20} y={104} width={7} height={16} rx={2} fill="#666" />
      <Rect x={83} y={104} width={7} height={16} rx={2} fill="#666" />
      {/* side mirrors */}
      <Rect x={22} y={50} width={5} height={7} rx={1.5} fill="#999" />
      <Rect x={83} y={50} width={5} height={7} rx={1.5} fill="#999" />
      {/* tick marks connecting side-zone labels to the body */}
      <Rect x={20} y={75.5} width={6} height={1} fill="#666" />
      <Rect x={84} y={75.5} width={6} height={1} fill="#666" />
      {damages.map((d, i) => {
        const pos = ZONE_POSITIONS[d.zone];
        if (!pos) return null;
        return (
          <Text
            key={i}
            x={pos.x}
            y={pos.y}
            style={{ fontSize: 11, fontWeight: 700 }}
            textAnchor="middle"
          >
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
  const contractNumber = reservation.contract_number ?? "—";

  return (
    <Document title={`Contrat de location ${contractNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <LogoBadge />
          <Text style={styles.title}>CONTRAT DE LOCATION</Text>
        </View>

        {/* Row 1 — Conducteur / Autre conducteur */}
        <View style={styles.twoColRow}>
          <View style={styles.halfCol}>
            <Card title="Conducteur">
              <Field label="Nom & Prénom" value={getFullName(reservation)} />
              <Field label="Adresse" value={reservation.driver_address} />
              <Field label="Téléphone" value={reservation.driver_phone} />
              <Field label="N° C.I.N" value={reservation.cin_number} />
              <Field label="N° permis" value={reservation.driver_license_number} />
              <Field label="N° passeport" value={reservation.driver_passport_number} />
            </Card>
          </View>
          <View style={styles.halfCol}>
            <Card title="Autre conducteur">
              <Field
                label="Nom & Prénom"
                value={
                  reservation.has_second_driver
                    ? getFullName({
                        prenom: reservation.second_driver_prenom,
                        nom: reservation.second_driver_nom,
                      })
                    : ""
                }
              />
              <Field
                label="Adresse"
                value={reservation.has_second_driver ? reservation.second_driver_address : ""}
              />
              <Field
                label="Téléphone"
                value={reservation.has_second_driver ? reservation.second_driver_phone : ""}
              />
              <Field
                label="N° C.I.N"
                value={reservation.has_second_driver ? reservation.second_driver_cin_number : ""}
              />
              <Field
                label="N° permis"
                value={
                  reservation.has_second_driver ? reservation.second_driver_license_number : ""
                }
              />
              <Field
                label="N° passeport"
                value={
                  reservation.has_second_driver ? reservation.second_driver_passport_number : ""
                }
              />
            </Card>
          </View>
        </View>

        {/* Row 2 — Véhicule / Facturation */}
        <View style={styles.twoColRow}>
          <View style={styles.halfCol}>
            <Card title="Véhicule">
              <Field label="Marque" value={vehicle ? `${vehicle.brand} ${vehicle.model}` : reservation.vehicle_label} />
              <Field label="Immatriculation" value={reservation.registration_plate} />
              <Field
                label="Départ (jour et heure)"
                value={`${formatDate(reservation.start_date)} à ${reservation.start_time}`}
              />
              <Field
                label="Retour (jour et heure)"
                value={`${formatDate(reservation.end_date)} à ${reservation.end_time}`}
              />
              <Field label="Retour Finale" />
              <Field
                label="Km"
                value={
                  reservation.mileage_start != null || reservation.mileage_end != null
                    ? `${reservation.mileage_start ?? "—"} - ${reservation.mileage_end ?? "—"}`
                    : ""
                }
              />
            </Card>
          </View>
          <View style={styles.halfCol}>
            <Card title="Facturation">
              <Field label="Nombre de jours" value={`${billing.days}`} />
              <Field label="Frais de livraison" value={`${Number(reservation.delivery_fee).toFixed(2)} DH`} />
              <Field label="Frais de reprise" value={`${Number(reservation.pickup_fee).toFixed(2)} DH`} />
              <Field label="Avance" value={`${billing.avance.toFixed(2)} DH`} />
              <Field label="Reste à payer" value={`${billing.resteAPayer.toFixed(2)} DH`} />
              <Field label="Total à payer" value={`${billing.totalTTC.toFixed(2)} DH`} strong />
            </Card>
          </View>
        </View>

        {/* Row 3 — Validation du contrat / Dommages */}
        <View style={styles.row3}>
          <View style={styles.validationCol}>
            <Card title="Validation du contrat">
              <Field label="Fait à" value={reservation.fait_a} />
              <Field
                label="Date"
                value={
                  reservation.contract_generated_at
                    ? formatDate(reservation.contract_generated_at)
                    : ""
                }
              />
            </Card>
          </View>

          <View style={styles.damagesCol}>
            <Card title="Dommages">
              <View style={styles.damagesBody}>
                <View style={styles.legendCol}>
                  {DAMAGE_TYPES.map((t) => (
                    <View key={t.value} style={styles.legendItem}>
                      <Text style={styles.legendSymbol}>{t.symbol}</Text>
                      <Text style={styles.legendLabel}>{t.value}</Text>
                    </View>
                  ))}
                  <Text style={styles.legendCount}>
                    Nombre : {reservation.damages.length}
                  </Text>
                  <View style={styles.fuelRow}>
                    <View style={styles.checkboxRow}>
                      <View style={styles.checkbox} />
                      <Text style={styles.checkboxLabel}>Diesel</Text>
                    </View>
                    <View style={styles.checkboxRow}>
                      <View style={styles.checkbox} />
                      <Text style={styles.checkboxLabel}>Essence</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.carWrap}>
                  <CarDiagram damages={reservation.damages} />
                </View>
              </View>
            </Card>
          </View>
        </View>

        {/* Row 4 — Équipement du véhicule / Signatures */}
        <View style={styles.row4}>
          <View style={styles.equipCol}>
            <Card title="Équipement du véhicule">
              <View style={styles.equipGrid}>
                {EQUIPMENT_ITEMS.map((item) => {
                  const checked = Boolean(reservation.equipment[item.key]);
                  return (
                    <View key={item.key} style={styles.equipItem}>
                      <View style={[styles.equipCheckbox, ...(checked ? [styles.equipCheckboxChecked] : [])]} />
                      <Text style={styles.equipLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>

          <View style={styles.sigCol}>
            <Card title="Signatures">
              <Text style={styles.nbLabel}>NB :</Text>
              <Text style={styles.nbText}>
                Ce contrat ne vaut en aucun cas comme facture. Je déclare avoir pris connaissance
                de toutes les conditions stipulées au verso de ce contrat, et les approuver et
                être seul responsable à la législation relative à la circulation routière.
              </Text>
            </Card>
          </View>
        </View>

        {/* Signature strip */}
        <View style={styles.sigStripRow}>
          <View style={styles.sigStripCol}>
            <View style={styles.sigStripHeader}>
              <Text style={styles.sigStripHeaderText}>1er conducteur</Text>
            </View>
            <View style={styles.sigStripBody}>
              {reservation.signature_data ? (
                // react-pdf Image, not an HTML img; this component has no alt prop.
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={reservation.signature_data} style={styles.sigImage} />
              ) : null}
            </View>
          </View>
          <View style={styles.sigStripCol}>
            <View style={styles.sigStripHeader}>
              <Text style={styles.sigStripHeaderText}>2ème conducteur</Text>
            </View>
            <View style={styles.sigStripBody}>
              {reservation.signature_2_data ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={reservation.signature_2_data} style={styles.sigImage} />
              ) : null}
            </View>
          </View>
        </View>

        {reservation.signed_at && (
          <Text style={styles.auditLine}>
            Signé électroniquement le{" "}
            {new Date(reservation.signed_at).toLocaleString("fr-FR")} par{" "}
            {reservation.signer_name}{" "}
            (IP: {reservation.signer_ip})
          </Text>
        )}
        {reservation.signed_2_at && (
          <Text style={styles.auditLine}>
            2ème conducteur signé électroniquement le{" "}
            {new Date(reservation.signed_2_at).toLocaleString("fr-FR")} par{" "}
            {reservation.signer_2_name}{" "}
            (IP: {reservation.signer_2_ip})
          </Text>
        )}

        {/* Footer — pinned to the bottom of the page, no longer squeezed into the signature row */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerItem}>
              <Text style={styles.footerText}>Tél : +212 664 883 106</Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerText}>+212 661 412 759</Text>
            </View>
          </View>
          <View style={styles.footerAddressRow}>
            <Text style={styles.footerAddressText}>
              20, Rue Ghana App N°2 1er étage Diour Jamaa Rabat
            </Text>
          </View>
          <Text style={styles.footerRcText}>RC 195159   Ice 003887345000050</Text>
        </View>
      </Page>
    </Document>
  );
}