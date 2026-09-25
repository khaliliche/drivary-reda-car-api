import sharp from "sharp";

// Plain OCR on an unprocessed phone photo of an ID card is unreliable —
// uneven lighting, low contrast between embossed/printed text and the
// card background, and small font size all hurt Tesseract badly. This
// preprocessing pass fixes the parts that matter most for text
// recognition, without needing any ML model:
//
// - grayscale: color information doesn't help OCR and can hurt it
// - normalize: stretches the contrast range so faint text becomes solid
// - sharpen: crisper edges on small characters
// - upscale small images: Tesseract reads small text much better once
//   character height is comfortably above ~20-30px
export async function preprocessForOcr(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer).rotate(); // auto-orient from EXIF first
  const metadata = await image.metadata();

  const minDimension = Math.min(metadata.width ?? 0, metadata.height ?? 0);
  const targetMin = 1600;
  const scale = minDimension > 0 && minDimension < targetMin ? targetMin / minDimension : 1;

  let pipeline = image.grayscale().normalize();

  if (scale > 1) {
    pipeline = pipeline.resize({
      width: Math.round((metadata.width ?? 0) * scale),
      height: Math.round((metadata.height ?? 0) * scale),
      kernel: sharp.kernel.lanczos3,
    });
  }

  pipeline = pipeline.sharpen({ sigma: 1.2 });

  return pipeline.png().toBuffer();
}