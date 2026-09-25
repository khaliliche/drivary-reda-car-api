import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/auth";
import { consumeWindowedLimit } from "@/lib/db";
import { recognizeText, type OcrLang } from "@/lib/ocr/worker";
import { parseDocument, type DocType } from "@/lib/ocr/parse-document";

const VALID_DOC_TYPES: DocType[] = [
  "cin_recto",
  "cin_verso",
  "permis_recto",
  "permis_verso",
  "passport",
];

// CIN and permis are French-language documents; the passport is read via
// its MRZ line, which is a fixed Latin/OCR-B character set the "eng" model
// reads well. Loading only the language a document actually needs (instead
// of both every time) noticeably speeds up recognition.
const DOC_LANG: Record<DocType, OcrLang> = {
  cin_recto: "fra",
  cin_verso: "fra",
  permis_recto: "fra",
  permis_verso: "fra",
  passport: "eng",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — generous for a compressed phone photo

// This endpoint ONLY extracts a best-effort prefill from a document photo.
// It never writes to the reservations table — the customer always reviews
// and confirms the extracted values in the normal reservation form before
// anything is saved, via the existing POST /api/reservations.
export async function POST(request: NextRequest) {
  // Reuse the same fixed-window IP budget mechanism as reservations, with a
  // higher ceiling since one reservation can involve up to 5 scans (CIN x2,
  // permis x2, or passport + permis x2) plus a retake or two.
  const allowed = await consumeWindowedLimit(
    `ocr:${getClientIp(request.headers)}`,
    40,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json({ success: false, errorCode: "rateLimited" }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, errorCode: "invalidRequest" }, { status: 400 });
  }

  const docType = String(formData.get("doc_type") || "");
  if (!VALID_DOC_TYPES.includes(docType as DocType)) {
    return NextResponse.json({ success: false, errorCode: "invalidDocType" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, errorCode: "missingImage" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ success: false, errorCode: "missingImage" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ success: false, errorCode: "imageTooLarge" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ success: false, errorCode: "invalidImage" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await recognizeText(buffer, DOC_LANG[docType as DocType]);
    const fields = parseDocument(docType as DocType, text);

    return NextResponse.json({
      success: true,
      docType,
      fields,
      // Lets the UI warn the customer when almost nothing was read (bad
      // lighting, blur, wrong document) instead of silently showing an
      // empty form.
      fieldsFound: Object.keys(fields).length,
      // TEMP DEBUG: the raw text Tesseract actually read, so the parsing
      // rules in lib/ocr/parse-document.ts can be tuned against real
      // output instead of guessed blind. Remove this field (or gate it
      // behind an env var) once extraction is reliable enough for
      // production — it's not sensitive to return to the same browser
      // that just uploaded the document, but there's no reason to keep
      // shipping it once it's no longer useful.
      debugRawText: text,
    });
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return NextResponse.json({ success: false, errorCode: "ocrFailed" }, { status: 500 });
  }
}
