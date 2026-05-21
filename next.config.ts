import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin dev resource requests by default. The
  // e2e suite drives the dev server through 127.0.0.1 while Next.js
  // initializes against `localhost`; without this allowlist, hydration
  // fails silently and tests can't observe client state.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
