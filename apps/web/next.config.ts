import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace packages ship TypeScript source.
  transpilePackages: ["@sightline/contracts", "@sightline/engine", "@sightline/scene"],
};

export default nextConfig;
