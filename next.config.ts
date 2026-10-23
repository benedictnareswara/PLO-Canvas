import type { NextConfig } from "next";

// Every page in this app is per-user and session-gated, so the previous
// (request-time) rendering model is used instead of Cache Components.
const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
