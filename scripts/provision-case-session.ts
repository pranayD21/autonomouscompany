import {config} from "dotenv";
import {readFileSync} from "node:fs";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {provisionCaseSession} from "../backend/provision-case-session";
config({path:[".env.local",".env"],quiet:true});
const [caseId,authorityId,owner]=process.argv.slice(2);
if(!caseId||!authorityId||!owner||!process.env.NAIVE_SETUP_KEY_FILE)throw Error("Usage: NAIVE_SETUP_KEY_FILE=<private file> npx tsx scripts/provision-case-session.ts <case UUID> <authority UUID> <owner UUID>");
process.env.NAIVE_API_KEY=readFileSync(process.env.NAIVE_SETUP_KEY_FILE,"utf8").trim();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});
try{
 const run=await provisionCaseSession(drizzle(pool),{caseId,authorityId,owner,agentId:process.env.NAIVE_COORDINATOR_ID!,generalVersion:Number(process.env.NAIVE_GENERAL_AGENT_VERSION),toolsUrl:process.env.NAIVE_CASE_TOOLS_URL!});
 console.log(JSON.stringify({registered:true,id:run.id,state:run.state,case_id:run.case_id}));
}catch(error){
 const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:"PROVIDER_OR_DATABASE_ERROR";
 console.error(code);
 console.error("Case provisioning failed; no new database binding was committed. Retry with the same case and authority after inspecting provider configuration. Do not reset the grant.");process.exitCode=1;
}finally{await pool.end();}
