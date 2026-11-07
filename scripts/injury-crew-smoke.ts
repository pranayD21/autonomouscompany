import {config} from "dotenv";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {startCrew,naiveClient,crewOutput} from "../backend/providers/naive";
config({path:[".env.local",".env"],quiet:true});
const path="test-results/injury-crew-smoke.json";
const run=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{runId:randomUUID(),caseId:randomUUID()};
writeFileSync(path,JSON.stringify(run),{mode:0o600});
if(!run.sessionId){
 const session=await startCrew(run.runId,run.caseId,JSON.stringify({case_type:"workplace_injury",intake:{contact_name:"Synthetic worker",contact_email:"worker@example.com",injury_description:"Synthetic chemical burn at a pharmaceutical office. Employer, jurisdiction, incident date, insurer and treatment records are not yet known."},bill_cents:null,eob_cents:null,notes:"No claims submitted or external contacts authorized. Prepare the next small step, not a comprehensive questionnaire."}));
 run.sessionId=session.id;writeFileSync(path,JSON.stringify(run),{mode:0o600});
}
const session=await naiveClient().sessions.get(run.sessionId);const parsed=crewOutput.safeParse(session.structured_output);
console.log(JSON.stringify({sessionId:session.id,status:session.status,stop_reason:session.stop_reason,output_valid:parsed.success}));
if(session.status==="idle"&&session.stop_reason==="end_turn"&&parsed.success){
 const r=parsed.data;
 if(r.potential_discrepancy_cents!==null||!r.next_questions?.length||r.next_questions.length>3||/no platform (?:email|messaging)|all 25|25[- ]field/i.test(JSON.stringify(r)))throw new Error("Injury review failed progressive-intake/content checks");
 writeFileSync("test-results/injury-crew-result.json",JSON.stringify(r),{mode:0o600});console.log("PASS injury review asks up to three next questions and preserves unknown financial outcome");
}else process.exitCode=session.stop_reason==="error"||session.status==="failed"?1:2;
