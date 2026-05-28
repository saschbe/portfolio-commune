import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fjglbztexnntivdrjhbv.supabase.co",
      },
    ],
  },
};

export default nextConfig;
