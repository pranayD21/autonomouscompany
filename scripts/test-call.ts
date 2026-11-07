import {config} from "dotenv";
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync} from "node:fs";
config({path:[".env.local",".env"],quiet:true});
mkdirSync("test-results",{recursive:true});
const record="test-results/agentphone-call.json";
const headers={Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`,"Content-Type":"application/json"};
if(process.argv.includes("--place-authorized-test") || process.argv.includes("--retry-funded-test")) {
 if(existsSync(record)) {
  const previous=JSON.parse(readFileSync(record,"utf8"));
  if(!process.argv.includes("--retry-funded-test") || previous.httpStatus!==402 || previous.result?.id) throw new Error("A call was already attempted. Only a confirmed funding refusal may be retried explicitly.");
  renameSync(record,`test-results/agentphone-call-refused-${Date.now()}.json`);
 }
 if(!/^\+[1-9]\d{7,14}$/.test(process.env.AUTHORIZED_TEST_NUMBER??"")) throw new Error("Set AUTHORIZED_TEST_NUMBER to an authorized E.164 destination");
 writeFileSync(record,JSON.stringify({status:"request_started",at:new Date().toISOString()}),{mode:0o600});
 const response=await fetch("https://api.agentphone.ai/v1/calls",{method:"POST",headers,signal:AbortSignal.timeout(25000),body:JSON.stringify({
   agentId:process.env.AGENTPHONE_AGENT_ID,fromNumberId:process.env.AGENTPHONE_NUMBER_ID,toNumber:process.env.AUTHORIZED_TEST_NUMBER,
   disableRecording:true,ringTimeoutSeconds:25,
   initialGreeting:"Hi, this is Bill Advocate's AI assistant calling for the demo test you requested. This uses fictional billing details only. Is now a good time?",
 })});
 const result=await response.json();writeFileSync(record,JSON.stringify({httpStatus:response.status,result}),{mode:0o600});
 console.log(JSON.stringify({httpStatus:response.status,id:result.id,status:result.status,error:result.error?.code}));
 if(!response.ok) process.exitCode=1;
} else {
 const saved=JSON.parse(readFileSync(record,"utf8"));const id=saved.result?.id;
 if(!id) throw new Error("No confirmed call ID; inspect local record, do not automatically retry");
 const r=await fetch(`https://api.agentphone.ai/v1/calls/${encodeURIComponent(id)}`,{headers});
 const d=await r.json();writeFileSync("test-results/agentphone-call-status.json",JSON.stringify(d),{mode:0o600});
 console.log(JSON.stringify({httpStatus:r.status,id:d.id,status:d.status,duration:d.durationSeconds,recording_present:!!d.recordingUrl}));
}
