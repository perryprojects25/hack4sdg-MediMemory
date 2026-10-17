import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hackathon demo mode (lib/demo-mode.ts): one setting, readable on the server and in the browser.
  env: { NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE === "true" ? "true" : "false" },
};

export default nextConfig;
