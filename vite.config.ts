import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Only these public service locations enter the client bundle.
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_NEON_AUTH_URL": JSON.stringify(env.NEON_AUTH_BASE_URL),
      "import.meta.env.VITE_NEON_REALTIME_URL": JSON.stringify(env.NEON_REALTIME_URL),
      "import.meta.env.VITE_CASES_API_URL": JSON.stringify(
        `https://${env.NEON_BRANCH_ID}-cases${env.NEON_FUNCTION_HOST_SUFFIX}`,
      ),
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
