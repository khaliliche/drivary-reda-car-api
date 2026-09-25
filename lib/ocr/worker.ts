import path from "path";
import os from "os";
import { createWorker, type Worker } from "tesseract.js";
import { preprocessForOcr } from "./preprocess";

// Self-hosted OCR via tesseract.js — no per-document API fees, runs on our
// own server/serverless function.
//
// PERFORMANCE: creating a Tesseract worker (loading the language model,
// spinning up the WASM engine) is the expensive part — not the actual
// recognition. So instead of creating + tearing down a worker on every
// scan, we keep ONE worker alive for the life of the Node process and
// reuse it across requests. The first scan after a (re)start still pays
// the language-load cost; every scan after that on the same running
// server is fast (recognition only, no init).
//
// Language data: by default tesseract.js downloads the trained-data files
// (fra.traineddata.gz, eng.traineddata.gz) from a public CDN the first time
// they're needed, then caches them on disk (cachePath below) so it isn't
// re-downloaded on every request. If this deploys somewhere with
// restricted egress or an ephemeral filesystem (some serverless
// platforms), download fra/eng traineddata once and set TESSDATA_PATH to a
// local folder (e.g. bundled under public/tessdata) so recognition never
// depends on outbound internet at request time.
//
// Note: on a serverless platform where each request can hit a fresh cold
// instance, the "reuse across requests" benefit only applies within a warm
// instance — a cold start still pays the one-time language-load cost.

export type OcrLang = "fra" | "eng";

let workerPromise: Promise<Worker> | null = null;
let currentLang: OcrLang | null = null;

async function getWorker(lang: OcrLang): Promise<Worker> {
  const tessdataPath = process.env.TESSDATA_PATH;
  const cachePath = process.env.TESSDATA_CACHE_PATH || path.join(os.tmpdir(), "tesseract-cache");

  if (!workerPromise) {
    currentLang = lang;
    workerPromise = createWorker(lang, undefined, {
      ...(tessdataPath ? { langPath: tessdataPath, gzip: false } : {}),
      cachePath,
    });
    return workerPromise;
  }

  const worker = await workerPromise;
  if (currentLang !== lang) {
    // Cheaper than tearing down and recreating the whole worker — swaps
    // the loaded language model only.
    await worker.reinitialize(lang);
    currentLang = lang;
  }
  return worker;
}

/**
 * Runs OCR on a single image and returns the raw recognized text.
 * lang: "fra" for Moroccan CIN / permis de conduire, "eng" for the
 * passport MRZ (Latin/OCR-B character set).
 */
export async function recognizeText(imageBuffer: Buffer, lang: OcrLang = "fra"): Promise<string> {
  const worker = await getWorker(lang);
  const processed = await preprocessForOcr(imageBuffer);
  const {
    data: { text },
  } = await worker.recognize(processed);
  return text;
}