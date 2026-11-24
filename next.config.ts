import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Every page in this app is per-user and session-gated, so the previous
// (request-time) rendering model is used instead of Cache Components.
const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  // Basic hardening for every response: no framing (clickjacking), no MIME sniffing, and only the
  // origin in the Referer sent to other sites.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
