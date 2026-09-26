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
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff;
  const isPng =
    headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4e && headerBytes[3] === 0x47;
  const isWebp =
    headerBytes[0] === 0x52 &&
    headerBytes[1] === 0x49 &&
    headerBytes[2] === 0x46 &&
    headerBytes[3] === 0x46 &&
    headerBytes[8] === 0x57 &&
    headerBytes[9] === 0x45 &&
    headerBytes[10] === 0x42;
  if (!isJpeg && !isPng && !isWebp) {
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
      fieldsFound: Object.keys(fields).length,
    });
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return NextResponse.json({ success: false, errorCode: "ocrFailed" }, { status: 500 });
  }
}
