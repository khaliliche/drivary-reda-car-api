import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js resolves its worker script with a dynamic require() path
  // that webpack can't follow — bundling it breaks that file at runtime.
  // Keep it external so Node loads it straight from node_modules instead.
  serverExternalPackages: ["tesseract.js"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tkevjdipmoberbxjggcv.supabase.co",
      },
    ],
  },
};

export default nextConfig;