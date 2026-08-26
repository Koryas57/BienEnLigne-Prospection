import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: process.env.NODE_ENV === "development" ? ["192.168.1.79"] : undefined,
};

export default nextConfig;
