// Pure token helpers, safe to use in the Edge Runtime (middleware).
// The DB-backed rate limiting lives in ./auth.ts.

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  // Compare fixed-length SHA-256 digests instead of the raw strings, so
  // there's no length-mismatch early exit that leaks how long the correct
  // value is via response timing.
  const [hashA, hashB] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let result = 0;
  for (let i = 0; i < hashA.length; i++) {
    result |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  }
  return result === 0;
}

// Session token derived from the password + a separate secret, so the
// cookie never contains the raw admin password.
export async function getExpectedSessionToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!password || !secret) return null;

  // Daily rotation bucket: the expected token changes every UTC day, so a
  // stolen cookie stops working within 24h even if env vars never change.
  const dayBucket = Math.floor(Date.now() / 86400000);
  return sha256Hex(`${password}:${secret}:${dayBucket}`);
}

export async function checkPassword(submitted: string): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !submitted) return false;
  return await timingSafeEqual(submitted, password);
}