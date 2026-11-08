import {config} from "dotenv";import {writeFileSync,mkdirSync} from "node:fs";import {Pool} from "pg";import {naiveClient} from "../../backend/providers/naive";
config({path:[".env.local",".env"],quiet:true});
const caseId=process.env.DEMO_CASE_ID;if(!caseId)throw Error("DEMO_CASE_ID required");
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});
try{
 const {rows}=await pool.query("SELECT s.session_id,c.owner_id FROM advocacy_case_agent_sessions s JOIN advocacy_cases c ON c.id=s.case_id WHERE s.case_id=$1 AND s.session_id IS NOT NULL ORDER BY s.created_at DESC LIMIT 1",[caseId]);
 const row=rows[0];if(!row||!(process.env.CREW_ALLOWED_USER_IDS??"").split(",").includes(row.owner_id))throw Error("No operator-owned Naïve session for this case");
 // One existing-session read, through the same capacity governor. No creation or polling loop.
 const events=await naiveClient().sessions.events(row.session_id,{limit:100});
 const messages=events.data.filter(e=>e.type==="message.completed"&&e.data.role==="assistant"&&typeof e.data.content==="string").map(e=>e.data.content);
 if(!messages.length)throw Error("No completed Naïve handoff available");
 mkdirSync("test-results",{recursive:true});writeFileSync(`test-results/demo-naive-${caseId}.json`,JSON.stringify({caseId,sessionId:row.session_id,capturedAt:new Date().toISOString(),messages},null,2),{mode:0o600});
 console.log("Cached genuine Naïve handoff with one events request; no new session or inference.");
}finally{await pool.end();}
