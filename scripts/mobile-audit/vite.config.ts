// Local-only Vite config for the iPhone audit: serves the real app with the realtime client mocked.
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {alias: {"@neon/realtime-react": fileURLToPath(new URL("./mock-realtime.tsx", import.meta.url))}},
  server: {host: "127.0.0.1", port: 4290, strictPort: true},
});
