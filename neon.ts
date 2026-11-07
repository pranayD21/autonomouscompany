import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: { allowedOrigins: ["http://localhost:5173", "http://localhost:4173"] },
  },
  auth: true,
  aiGateway: true,
  functions: {
    hello: { name: "Hello World", source: "./hello.ts" },
    cases: {
      name: "Medical bill case API",
      source: "./backend/api.ts",
      env: {
        REALTIME_SECRET: { value: process.env.NEON_REALTIME_SECRET, required: true },
        APP_ORIGINS: "http://localhost:5173,http://localhost:4173",
        NAIVE_API_KEY: { value: process.env.NAIVE_API_KEY, required: true },
        NAIVE_COORDINATOR_ID: { value: process.env.NAIVE_COORDINATOR_ID, required: true },
        NAIVE_RUN_BUDGET_MICRO_USD: { value: process.env.NAIVE_RUN_BUDGET_MICRO_USD, required: true },
        CREW_ALLOWED_USER_IDS: process.env.CREW_ALLOWED_USER_IDS ?? "",
      },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
