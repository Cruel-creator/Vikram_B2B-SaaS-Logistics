import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The pipeline only runs server-side; keep these SDKs out of the client bundle.
  serverExternalPackages: ["@mendable/firecrawl-js"],
};

export default nextConfig;
