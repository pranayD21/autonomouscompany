import { config } from "dotenv";
import { createClient, ApiError } from "@usenaive-sdk/managed-agents";
import { Pool } from "pg";
import {voiceProvider} from "../backend/providers/outreach";
config({ path: [".env.local", ".env"], quiet: true });
let failures = 0;
function report(service: string, state: string) { console.log(`${service}: ${state}`); }
async function check(name: string, keys: string[], run: () => Promise<string>) {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length) { failures++; report(name, `NOT CONFIGURED — ${missing.join(", ")}`); return; }
  try { report(name, await run()); } catch (error) {
    failures++; report(name, error instanceof ApiError ? `FAILED — ${error.code}; request ${error.requestId}` : `FAILED — ${error instanceof Error ? error.name : "unknown error"}`);
  }
}
async function get(url: string, headers: Record<string,string> = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
await check("Neon Postgres", ["DATABASE_URL"], async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL!.replace("sslmode=require", "sslmode=verify-full"), connectionTimeoutMillis: 15000 });
  try { await pool.query("SELECT 1 FROM advocacy_cases LIMIT 1"); return "CONNECTED — case table accessible"; } finally { await pool.end(); }
});
await check("Neon Auth", ["NEON_AUTH_JWKS_URL"], async () => { const data = await get(process.env.NEON_AUTH_JWKS_URL!); if (!data.keys?.length) throw new Error("Empty JWKS"); return "REACHABLE — signing keys published (not a login test)"; });
await check("Neon AI Gateway", ["NEON_AI_GATEWAY_BASE_URL", "NEON_AI_GATEWAY_TOKEN"], async () => {
  const data = await get(`${process.env.NEON_AI_GATEWAY_BASE_URL}/v1/models`, { Authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}` });
  const enabled = data.data.filter((m: {enabled?: boolean}) => m.enabled);
  if (!enabled.length) { failures++; return "BLOCKED — no enabled models; check gateway credits"; }
  return `CONNECTED — ${enabled.length} enabled models (no inference run)`;
});
await check("Naïve", ["NAIVE_API_KEY"], async () => { const client = createClient({ baseUrl: "https://api.vetta.sh", apiKey: process.env.NAIVE_API_KEY! }); const agents = await client.agents.list({limit:100}); return `CONNECTED — ${agents.data.length} agents visible; coordinator ${agents.data.some(a => a.name === "bill-advocate-coordinator") ? "present" : "not provisioned"}`; });
await check("ElevenLabs", ["ELEVENLABS_API_KEY"], async () => { await get("https://api.elevenlabs.io/v1/convai/agents", { "xi-api-key": process.env.ELEVENLABS_API_KEY! }); return "CONNECTED — agent list accessible (no call placed)"; });
if(voiceProvider()==="agentphone") {
  await check("AgentPhone calling",["AGENTPHONE_API_KEY","AGENTPHONE_AGENT_ID","AGENTPHONE_NUMBER_ID"],async()=>{
    const agent=await get(`https://api.agentphone.ai/v1/agents/${encodeURIComponent(process.env.AGENTPHONE_AGENT_ID!)}`,{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`});
    if(agent.id!==process.env.AGENTPHONE_AGENT_ID||agent.voiceMode!=="hosted"||!agent.numbers?.some((n:{id:string;status:string})=>n.id===process.env.AGENTPHONE_NUMBER_ID&&n.status==="active"))throw new Error("Hosted agent or active number mismatch");
    return "CONNECTED — hosted agent and configured active number verified; no call placed";
  });
} else if(voiceProvider()==="elevenlabs") {
await check("ElevenLabs/Twilio calling", ["ELEVENLABS_API_KEY", "ELEVENLABS_OUTREACH_AGENT_ID", "ELEVENLABS_PHONE_NUMBER_ID"], async () => {
  const headers={"xi-api-key":process.env.ELEVENLABS_API_KEY!};
  const number=await get(`https://api.elevenlabs.io/v1/convai/phone-numbers/${encodeURIComponent(process.env.ELEVENLABS_PHONE_NUMBER_ID!)}`,headers);
  if(number.provider!=="twilio"||number.supports_outbound===false)throw new Error("Twilio number is not outbound-capable");
  return "CONFIGURED — imported Twilio number accessible; live calling not verified";
});
} else { failures++; report("Voice routing","BLOCKED — invalid OUTREACH_VOICE_PROVIDER"); }
await check("AgentMail", ["AGENTMAIL_API_KEY", "AGENTMAIL_INBOX_ID"], async () => { await get(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(process.env.AGENTMAIL_INBOX_ID!)}/messages`, { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` }); return "CONNECTED — scoped inbox messages accessible (no email sent)"; });
process.exitCode = failures ? 1 : 0;
