import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { startCrew, naiveClient, crewOutput } from "../backend/providers/naive";
config({path:[".env.local",".env"],quiet:true});
mkdirSync("test-results",{recursive:true});
const path="test-results/crew-smoke.json";
if (!existsSync(path)) writeFileSync(path,JSON.stringify({runId:randomUUID(),caseId:randomUUID()}),{mode:0o600});
const run=JSON.parse(readFileSync(path,"utf8"));
if (!run.sessionId) {
  const session=await startCrew(run.runId,run.caseId,JSON.stringify({instruction:"Review this synthetic example. Delegate intake and investigation to specialists, then return the required structured plan. No external actions are authorized.",bill_cents:120000,eob_cents:40000,notes:"Only these amounts are known. No itemized bill, payer adjustment, or payment evidence supplied."}));
  run.sessionId=session.id;writeFileSync(path,JSON.stringify(run),{mode:0o600});
}
const session=await naiveClient().sessions.get(run.sessionId);
console.log(JSON.stringify({sessionId:session.id,status:session.status,stop_reason:session.stop_reason,consumed_micro_usd:session.consumed_micro_usd,output_valid:crewOutput.safeParse(session.structured_output).success,result:session.structured_output},null,2));
const parsed=crewOutput.safeParse(session.structured_output);
const valid=parsed.success && parsed.data.potential_discrepancy_cents===80000 && parsed.data.missing_information.length>0 && parsed.data.human_help_required;
if((session.status==="completed" || (session.status==="idle" && session.stop_reason==="end_turn")) && valid) console.log("PASS Naive structured case review");
else process.exitCode=(session.status==="failed" || session.status==="cancelled" || session.stop_reason==="error") ? 1 : 2;
