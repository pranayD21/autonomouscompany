import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Public production endpoints, already visible in the deployed client bundle. They hold no
// credentials and let anyone build the app without private files. Environment values win.
const productionUrls = {
  auth: "https://ep-wandering-sun-bebpjoqp.neonauth.c-9.us-east-2.aws.neon.tech/neondb/auth",
  realtime: "wss://ep-wandering-sun-bebpjoqp.rt.c-9.us-east-2.aws.neon.tech/",
  api: "https://br-square-pine-bewan9j8-cases.compute.c-9.us-east-2.aws.neon.tech",
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicUrls = {
    auth: env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || productionUrls.auth,
    realtime: env.VITE_NEON_REALTIME_URL || env.NEON_REALTIME_URL || productionUrls.realtime,
    api: env.VITE_CASES_API_URL || (env.NEON_BRANCH_ID && env.NEON_FUNCTION_HOST_SUFFIX
      ? `https://${env.NEON_BRANCH_ID}-cases${env.NEON_FUNCTION_HOST_SUFFIX}` : productionUrls.api),
  };
  for (const [name, value] of Object.entries(publicUrls)) {
    if (!value || !["https:", "wss:"].includes(new URL(value).protocol)) {
      throw new Error(`Invalid public ${name} URL. Check the VITE_* service URLs.`);
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
