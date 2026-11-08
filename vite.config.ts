import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicUrls = {
    auth: env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL,
    realtime: env.VITE_NEON_REALTIME_URL || env.NEON_REALTIME_URL,
    api: env.VITE_CASES_API_URL || (env.NEON_BRANCH_ID && env.NEON_FUNCTION_HOST_SUFFIX
      ? `https://${env.NEON_BRANCH_ID}-cases${env.NEON_FUNCTION_HOST_SUFFIX}` : undefined),
  };
  for (const [name, value] of Object.entries(publicUrls)) {
    if (!value || !["https:", "wss:"].includes(new URL(value).protocol)) {
      throw new Error(`Missing or invalid public ${name} URL. Configure the three VITE_* service URLs.`);
    }
  }
  // Only these public service locations enter the client bundle.
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_NEON_AUTH_URL": JSON.stringify(publicUrls.auth),
      "import.meta.env.VITE_NEON_REALTIME_URL": JSON.stringify(publicUrls.realtime),
      "import.meta.env.VITE_CASES_API_URL": JSON.stringify(publicUrls.api),
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
