// Turns raw Tesseract text into the SAME field names used by the
// reservations table / CreateReservationInput. This is intentionally
// heuristic (regex + label matching) rather than a trained model — it's
// meant to pre-fill the customer info form, never to save data directly.
// Every field carries a confidence so the UI can flag guesses for the
// customer to double check, but every field is always editable regardless.

export type DocType =
  | "cin_recto"
  | "cin_verso"
  | "permis_recto"
  | "permis_verso"
  | "passport";

export type FieldKey =
  | "prenom"
  | "nom"
  | "date_naissance"
  | "cin_number"
  | "cin_delivered_le"
  | "driver_license_number"
  | "license_issue_date"
  | "driver_passport_number"
  | "passport_delivered_le"
  | "driver_address";

export type ExtractedField = { value: string; confidence: "high" | "low" };
export type ExtractedFields = Partial<Record<FieldKey, ExtractedField>>;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---- date helpers ----

// dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, with 2- or 4-digit years.
const DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;

function normalizeDmy(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  let year = Number(y);
  if (year < 100) {
    const currentYY = new Date().getFullYear() % 100;
    year += year <= currentYY ? 2000 : 1900;
  }
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function findDateNear(allLines: string[], labelRe: RegExp): string | null {
  for (let i = 0; i < allLines.length; i++) {
    if (labelRe.test(allLines[i])) {
      // Same line first, then the next couple of lines (labels and values
      // often land on separate OCR lines).
      for (const candidate of [allLines[i], allLines[i + 1], allLines[i + 2]]) {
        if (!candidate) continue;
        const m = candidate.match(DATE_RE);
        if (m) return normalizeDmy(m[1], m[2], m[3]);
      }
    }
  }
  return null;
}

function findAnyDate(allLines: string[]): string | null {
  for (const l of allLines) {
    const m = l.match(DATE_RE);
    if (m) {
      const d = normalizeDmy(m[1], m[2], m[3]);
      if (d) return d;
    }
  }
  return null;
}

// ---- label-based value extraction ----

function findValueNear(allLines: string[], labelRe: RegExp): string | null {
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const match = line.match(labelRe);
    if (!match) continue;
    // Value after the label on the same line (strip the label + separators).
    const rest = line.slice((match.index ?? 0) + match[0].length).replace(/^[\s:.-]+/, "");
    if (rest && rest.length >= 2) return cleanupName(rest);
    // Otherwise take the next non-empty line.
    const next = allLines[i + 1];
    if (next) return cleanupName(next);
  }
  return null;
}

function cleanupName(raw: string): string {
  return raw
    .replace(/[^\p{L}\s'\-]/gu, " ") // drop stray digits/symbols OCR picks up
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Moroccan CIN number ----
// Typical format: 1-2 uppercase letters + 5-7 digits (e.g. "A123456",
// "BE445566"), sometimes with a stray OCR space between the letters/digits.
const CIN_RE = /\b([A-Z]{1,2})\s?-?\s?(\d{5,7})\b/;

function findCinNumber(rawUpper: string): string | null {
  const m = rawUpper.match(CIN_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}`;
}

// ---- Moroccan driving licence number ----
// Commonly digits, sometimes "RR/NNNNNN" (2-digit region prefix / number).
const PERMIS_RE = /\b(\d{2}\/\d{5,7}|\d{6,10})\b/;

function findPermisNumber(allLines: string[]): string | null {
  for (let i = 0; i < allLines.length; i++) {
    if (/permis|driving\s*licen[cs]e|n[°o]\s*permis/i.test(allLines[i])) {
      for (const candidate of [allLines[i], allLines[i + 1]]) {
        if (!candidate) continue;
        const m = candidate.match(PERMIS_RE);
        if (m) return m[1];
      }
    }
  }
  // Fallback: first plausible standalone number on the document.
  for (const l of allLines) {
    const m = l.match(PERMIS_RE);
    if (m) return m[1];
  }
  return null;
}

// ---- Carte Nationale (recto) ----
function parseCinRecto(text: string): ExtractedFields {
  const raw = lines(text);
  const upper = text.toUpperCase();
  const out: ExtractedFields = {};

  const nom = findValueNear(raw, /\bNOM\b/i);
  if (nom) out.nom = { value: nom, confidence: "high" };

  const prenom = findValueNear(raw, /\bPR[ÉE]NOM\b/i);
  if (prenom) out.prenom = { value: prenom, confidence: "high" };

  const cin = findCinNumber(upper);
  if (cin) out.cin_number = { value: cin, confidence: "high" };

  const naissance = findDateNear(raw, /N[ÉE]E?\s*LE|NAISSANCE/i) ?? findAnyDate(raw);
  if (naissance) out.date_naissance = { value: naissance, confidence: "high" };

  return out;
}

// ---- Carte Nationale (verso) ----
function parseCinVerso(text: string): ExtractedFields {
  const raw = lines(text);
  const out: ExtractedFields = {};

  const address = findValueNear(raw, /\bADRESSE\b/i);
  if (address) out.driver_address = { value: address, confidence: "low" };

  const delivered = findDateNear(raw, /D[ÉE]LIVR[ÉE]E?\s*LE|FAIT\s*LE/i);
  if (delivered) out.cin_delivered_le = { value: delivered, confidence: "high" };

  return out;
}

// ---- Permis de conduire (recto) ----
function parsePermisRecto(text: string): ExtractedFields {
  const raw = lines(text);
  const out: ExtractedFields = {};

  const nom = findValueNear(raw, /\bNOM\b/i);
  if (nom) out.nom = { value: nom, confidence: "low" };

  const prenom = findValueNear(raw, /\bPR[ÉE]NOM\b/i);
  if (prenom) out.prenom = { value: prenom, confidence: "low" };

  const permis = findPermisNumber(raw);
  if (permis) out.driver_license_number = { value: permis, confidence: "high" };

  const issued = findDateNear(raw, /D[ÉE]LIVR[ÉE]E?\s*LE|DATE\s*DE\s*D[ÉE]LIVRANCE/i);
  if (issued) out.license_issue_date = { value: issued, confidence: "high" };

  return out;
}

// ---- Permis de conduire (verso) ----
// Verso mainly carries category grid (A/B/C/...) — not needed for our
// fields, but a delivery date sometimes repeats here too.
function parsePermisVerso(text: string): ExtractedFields {
  const raw = lines(text);
  const out: ExtractedFields = {};
  const issued = findDateNear(raw, /D[ÉE]LIVR[ÉE]E?\s*LE/i);
  if (issued) out.license_issue_date = { value: issued, confidence: "low" };
  return out;
}

// ---- Passport MRZ (TD3, 2 lines x 44 chars) ----
// Standard ICAO 9303 machine-readable zone — far more reliable than reading
// the printed fields, so we look for it first and only fall back to
// printed-field heuristics if it's not found.
const MRZ_LINE_RE = /^[A-Z0-9<]{40,44}$/;

function mrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  const values: Record<string, number> = {};
  for (let i = 0; i < 10; i++) values[String(i)] = i;
  for (let i = 0; i < 26; i++) values[String.fromCharCode(65 + i)] = i + 10;
  values["<"] = 0;
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const v = values[input[i]] ?? 0;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

function mrzYearToFull(yy: number, preferPast: boolean): number {
  const currentYY = new Date().getFullYear() % 100;
  const asRecent = yy + 2000;
  const asOld = yy + 1900;
  if (preferPast) {
    // Birth dates: pick whichever keeps the person under ~100 years old.
    return yy > currentYY ? asOld : asRecent;
  }
  // Expiry dates: passports are valid ~10 years, so prefer the reading
  // closer to "now or the recent future/past".
  return asRecent;
}

function parseMrz(text: string): ExtractedFields {
  const candidates = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").toUpperCase())
    .filter((l) => MRZ_LINE_RE.test(l));

  const out: ExtractedFields = {};
  if (candidates.length < 2) return out;

  // The two MRZ lines are the last two matches (in case other text on the
  // page also happens to look line-like).
  const [line1, line2] = candidates.slice(-2).map((l) => l.padEnd(44, "<").slice(0, 44));

  if (line1.startsWith("P")) {
    const nameField = line1.slice(5); // surname<<given names<<<...
    const [surname, givenRaw] = nameField.split("<<");
    if (surname) {
      out.nom = { value: surname.replace(/</g, " ").trim(), confidence: "high" };
    }
    if (givenRaw) {
      out.prenom = {
        value: givenRaw.replace(/</g, " ").trim(),
        confidence: "high",
      };
    }
  }

  // Line 2: passport number(9) + check(1) + nationality(3) + DOB(6) + check(1)
  //         + sex(1) + expiry(6) + check(1) + personal number(14) + check(1) + final check(1)
  const passportNumberRaw = line2.slice(0, 9);
  const passportCheck = line2[9];
  const dob = line2.slice(13, 19);
  const dobCheck = line2[19];
  const expiry = line2.slice(21, 27);

  const passportNumber = passportNumberRaw.replace(/</g, "");
  if (passportNumber) {
    const valid = String(mrzCheckDigit(passportNumberRaw)) === passportCheck;
    out.driver_passport_number = {
      value: passportNumber,
      confidence: valid ? "high" : "low",
    };
  }

  if (/^\d{6}$/.test(dob)) {
    const validDob = String(mrzCheckDigit(dob)) === dobCheck;
    const yy = Number(dob.slice(0, 2));
    const mm = dob.slice(2, 4);
    const dd = dob.slice(4, 6);
    const year = mrzYearToFull(yy, true);
    out.date_naissance = {
      value: `${year}-${mm}-${dd}`,
      confidence: validDob ? "high" : "low",
    };
  }

  if (/^\d{6}$/.test(expiry)) {
    // Passport "délivré le" isn't on the MRZ directly, but issue date =
    // expiry date minus the validity period isn't reliable to infer, so we
    // leave passport_delivered_le for the printed-field fallback below.
  }

  return out;
}

function parsePassport(text: string): ExtractedFields {
  const mrzFields = parseMrz(text);
  if (mrzFields.nom && mrzFields.prenom && mrzFields.driver_passport_number) {
    return mrzFields;
  }

  // Fallback: printed field labels (used when the MRZ wasn't legible).
  const raw = lines(text);
  const out: ExtractedFields = { ...mrzFields };

  if (!out.nom) {
    const nom = findValueNear(raw, /\bSURNAME\b|\bNOM\b/i);
    if (nom) out.nom = { value: nom, confidence: "low" };
  }
  if (!out.prenom) {
    const prenom = findValueNear(raw, /GIVEN\s*NAMES?|\bPR[ÉE]NOM\b/i);
    if (prenom) out.prenom = { value: prenom, confidence: "low" };
  }
  if (!out.driver_passport_number) {
    const m = text.toUpperCase().match(/\b([A-Z]{1,2}\d{6,8})\b/);
    if (m) out.driver_passport_number = { value: m[1], confidence: "low" };
  }
  if (!out.date_naissance) {
    const dob = findDateNear(raw, /DATE\s*OF\s*BIRTH|N[ÉE]E?\s*LE/i);
    if (dob) out.date_naissance = { value: dob, confidence: "low" };
  }
  const delivered = findDateNear(raw, /DATE\s*OF\s*ISSUE|D[ÉE]LIVR[ÉE]E?\s*LE/i);
  if (delivered) out.passport_delivered_le = { value: delivered, confidence: "low" };

  return out;
}

export function parseDocument(docType: DocType, text: string): ExtractedFields {
  switch (docType) {
    case "cin_recto":
      return parseCinRecto(text);
    case "cin_verso":
      return parseCinVerso(text);
    case "permis_recto":
      return parsePermisRecto(text);
    case "permis_verso":
      return parsePermisVerso(text);
    case "passport":
      return parsePassport(text);
  }
}