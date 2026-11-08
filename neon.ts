import { defineConfig } from "@neon/config/v1";

const appOrigins = ["http://localhost:5173", "http://localhost:4173", "https://assurance-claims.vercel.app", "https://assurance.claims"];

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: { allowedOrigins: appOrigins },
  },
  buckets: { "case-documents": { access: "private" } },
  auth: true,
  aiGateway: true,
  functions: {
    tools: { name: "Assurance case tools", source: "./backend/case-tools-worker.ts", env: {
      CREW_ALLOWED_USER_IDS: process.env.CREW_ALLOWED_USER_IDS ?? "",
      AGENTMAIL_API_KEY: process.env.AGENTMAIL_API_KEY ?? "",
      AGENTMAIL_INBOX_ID: process.env.AGENTMAIL_INBOX_ID ?? "",
      AGENTPHONE_API_KEY: process.env.AGENTPHONE_API_KEY ?? "",
      AGENTPHONE_AGENT_ID: process.env.AGENTPHONE_AGENT_ID ?? "",
      AGENTPHONE_NUMBER_ID: process.env.AGENTPHONE_NUMBER_ID ?? "",
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "",
      ELEVENLABS_OUTREACH_AGENT_ID: process.env.ELEVENLABS_OUTREACH_AGENT_ID ?? "",
      ELEVENLABS_PHONE_NUMBER_ID: process.env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
      OUTREACH_ALLOWED_EMAILS: process.env.OUTREACH_ALLOWED_EMAILS ?? "",
      OUTREACH_ALLOWED_PHONES: process.env.OUTREACH_ALLOWED_PHONES ?? "",
      OUTREACH_VOICE_PROVIDER: process.env.OUTREACH_VOICE_PROVIDER ?? "elevenlabs",
    } },
    autopoll: {
      name: "Assurance autonomous case worker",
      source: "./backend/autonomy-worker.ts",
      env: {
        CREW_ALLOWED_USER_IDS: process.env.CREW_ALLOWED_USER_IDS ?? "",
        NAIVE_API_KEY: { value: process.env.NAIVE_API_KEY, required: true },
        NAIVE_COORDINATOR_ID: { value: process.env.NAIVE_COORDINATOR_ID, required: true },
        NAIVE_GENERAL_AGENT_VERSION: { value: process.env.NAIVE_GENERAL_AGENT_VERSION, required: true },
        NAIVE_CASE_TOOLS_URL: { value: process.env.NAIVE_CASE_TOOLS_URL, required: true },
        NAIVE_RUN_BUDGET_MICRO_USD: { value: process.env.NAIVE_RUN_BUDGET_MICRO_USD, required: true },
        AGENTMAIL_API_KEY: { value: process.env.AGENTMAIL_API_KEY, required: true },
        AGENTMAIL_INBOX_ID: { value: process.env.AGENTMAIL_INBOX_ID, required: true },
        AGENTPHONE_API_KEY: process.env.AGENTPHONE_API_KEY ?? "",
        AGENTPHONE_AGENT_ID: process.env.AGENTPHONE_AGENT_ID ?? "",
        AGENTPHONE_NUMBER_ID: process.env.AGENTPHONE_NUMBER_ID ?? "",
        OUTREACH_ALLOWED_EMAILS: process.env.OUTREACH_ALLOWED_EMAILS ?? "",
        OUTREACH_ALLOWED_PHONES: process.env.OUTREACH_ALLOWED_PHONES ?? "",
        OUTREACH_VOICE_PROVIDER: process.env.OUTREACH_VOICE_PROVIDER ?? "elevenlabs",
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "",
        ELEVENLABS_OUTREACH_AGENT_ID: process.env.ELEVENLABS_OUTREACH_AGENT_ID ?? "",
        ELEVENLABS_PHONE_NUMBER_ID: process.env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
      },
    },
    crewpoll: {
      name: "Assurance review monitor",
      source: "./backend/crew-worker.ts",
      env: { NAIVE_API_KEY: { value: process.env.NAIVE_API_KEY, required: true } },
    },
    replypoll: {
      name: "Assurance reply monitor",
      source: "./backend/reply-worker.ts",
      env: {
        AGENTMAIL_API_KEY: { value: process.env.AGENTMAIL_API_KEY, required: true },
        AGENTMAIL_INBOX_ID: { value: process.env.AGENTMAIL_INBOX_ID, required: true },
      },
    },
    hello: { name: "Hello World", source: "./hello.ts" },
    cases: {
      name: "Medical bill case API",
      source: "./backend/api.ts",
      env: {
        REALTIME_SECRET: { value: process.env.NEON_REALTIME_SECRET, required: true },
        APP_ORIGINS: appOrigins.join(","),
        NAIVE_API_KEY: { value: process.env.NAIVE_API_KEY, required: true },
        NAIVE_FILES_API_KEY: process.env.NAIVE_FILES_API_KEY ?? "",
        NAIVE_INTAKE_ID: process.env.NAIVE_INTAKE_ID ?? "",
        NAIVE_COORDINATOR_ID: { value: process.env.NAIVE_COORDINATOR_ID, required: true },
        NAIVE_GENERAL_AGENT_VERSION: { value: process.env.NAIVE_GENERAL_AGENT_VERSION, required: true },
        NAIVE_RUN_BUDGET_MICRO_USD: { value: process.env.NAIVE_RUN_BUDGET_MICRO_USD, required: true },
        AGENTPHONE_API_KEY: process.env.AGENTPHONE_API_KEY ?? "",
        AGENTPHONE_AGENT_ID: process.env.AGENTPHONE_AGENT_ID ?? "",
        AGENTPHONE_NUMBER_ID: process.env.AGENTPHONE_NUMBER_ID ?? "",
        OUTREACH_VOICE_PROVIDER: process.env.OUTREACH_VOICE_PROVIDER ?? "elevenlabs",
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "",
        ELEVENLABS_OUTREACH_AGENT_ID: process.env.ELEVENLABS_OUTREACH_AGENT_ID ?? "",
        ELEVENLABS_PHONE_NUMBER_ID: process.env.ELEVENLABS_PHONE_NUMBER_ID ?? "",
        AGENTMAIL_API_KEY: process.env.AGENTMAIL_API_KEY ?? "",
        AGENTMAIL_INBOX_ID: process.env.AGENTMAIL_INBOX_ID ?? "",
        OUTREACH_ALLOWED_PHONES: process.env.OUTREACH_ALLOWED_PHONES ?? "",
        OUTREACH_ALLOWED_EMAILS: process.env.OUTREACH_ALLOWED_EMAILS ?? "",
        CREW_ALLOWED_USER_IDS: process.env.CREW_ALLOWED_USER_IDS ?? "",
      },
    },
  },
  triggers: {
    "case-autonomy": { type: "schedule", function: "autopoll", functionPath: "/poll", cron: "*/5 * * * *" },
    "crew-monitor": { type: "schedule", function: "crewpoll", functionPath: "/poll", cron: "*/5 * * * *" },
    "reply-monitor": { type: "schedule", function: "replypoll", functionPath: "/poll", cron: "*/5 * * * *" },
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
