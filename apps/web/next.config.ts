import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.52", "192.168.1.7", "192.168.1.*"],
  async redirects() {
    return [
      // 2026-06-01: the premium gold-on-ivory portal lives at /admin/portal.
      // Steve's muscle memory still goes to /admin/dashboard — redirect to
      // the new portal so the demo always lands on the polished surface.
      { source: "/admin/dashboard", destination: "/admin/portal", permanent: false },
    ];
  },
};

export default nextConfig;