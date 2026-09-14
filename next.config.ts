import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/leads": ["./data/leads.db"],
    "/api/leads/meta": ["./data/leads.db"],
    "/api/leads/export": ["./data/leads.db"],
  },
};

export default nextConfig;
