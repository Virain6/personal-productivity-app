import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/api/*": ["./drizzle/**/*"] },
  turbopack: { root: process.cwd() },
};

export default nextConfig;
