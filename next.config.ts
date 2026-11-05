import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingIncludes: process.env.C21_DASHBOARD_SNAPSHOT === "1" ? {"/tecnico": ["./.dashboard-preview.json"], "/tecnico/contratos": ["./.dashboard-preview.json"]} : {},
};
export default nextConfig;
