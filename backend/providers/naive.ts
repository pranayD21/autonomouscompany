import { createClient } from "@usenaive-sdk/managed-agents";
import { z } from "zod";

export const crewOutput = z.object({
  summary: z.string(),
  potential_discrepancy_cents: z.number().int().nonnegative(),
  evidence: z.array(z.string()),
  missing_information: z.array(z.string()),
  next_actions: z.array(z.string()),
  human_help_required: z.boolean(),
  human_help_reason: z.string(),
});
export function naiveClient() {
  if (!process.env.NAIVE_API_KEY) throw new Error("NaiveNotConfigured");
  return createClient({ baseUrl: "https://api.vetta.sh", apiKey: process.env.NAIVE_API_KEY,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(25000) }),
  });
}
export function crewConfiguration() {
  const budget = Number(process.env.NAIVE_RUN_BUDGET_MICRO_USD);
  if (!process.env.NAIVE_API_KEY || !process.env.NAIVE_COORDINATOR_ID || !Number.isSafeInteger(budget) || budget <= 0) return null;
  return { agentId: process.env.NAIVE_COORDINATOR_ID, budget };
}
export async function startCrew(runId: string, caseId: string, message: string) {
  const config = crewConfiguration();
  if (!config) throw new Error("NaiveNotConfigured");
  return naiveClient().sessions.create({
    agent_id: config.agentId, message, budget_micro_usd: config.budget,
    output_schema: z.toJSONSchema(crewOutput), structured_output_required: true,
    metadata: { case_id: caseId, run_id: runId, data_mode: "synthetic" },
  }, { idempotencyKey: runId });
}
