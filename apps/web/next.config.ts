import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.52", "192.168.1.7", "192.168.1.*"],
};

export default nextConfig;