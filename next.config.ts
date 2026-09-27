import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/disasters", destination: "/api/disasters" },
      { source: "/disasters/:path*", destination: "/api/disasters/:path*" },
    ];
  },
};

export default nextConfig;
