import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
export default defineConfig({
  dialect: "postgresql", schema: "./backend/schema.ts", out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
});
