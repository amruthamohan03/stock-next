import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  eslint: {
    // No ESLint config is shipped with this foundation; don't block builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
