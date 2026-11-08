import {config} from "dotenv";
import {existsSync,readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import {cases,caseToolCredentials,caseAgentFacts} from "../backend/schema";
import {issueCaseToolCredential} from "../backend/case-tool-auth";
import {naiveClient} from "../backend/providers/naive";
import {caseAgentTools,caseSessionInput} from "../backend/providers/case-agent";
config({path:[".env.local",".env"],quiet:true});
const url=process.env.NAIVE_CASE_TOOLS_URL;if(!url)throw Error("NAIVE_CASE_TOOLS_URL required");
if(process.env.NAIVE_SETUP_KEY_FILE)process.env.NAIVE_API_KEY=readFileSync(process.env.NAIVE_SETUP_KEY_FILE,"utf8").trim();
const client=naiveClient(),agentId=process.env.NAIVE_COORDINATOR_ID!;
const path="test-results/case-agent-smoke-isolated-url.json";mkdirSync("test-results",{recursive:true});
type Fixture={caseId:string;operationId:string;identityId?:string;vaultId?:string;credentialId?:string;sealedId?:string;sessionId?:string;agentVersion?:number};
type State={runId:string;agentVersion?:number;fixtures:Fixture[];cleaned?:boolean};
const state:State=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{runId:randomUUID(),fixtures:[0,1].map(()=>({caseId:randomUUID(),operationId:randomUUID()}))};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});save();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:2});const db=drizzle(pool);
try{
 const mode=process.argv[2]??"poll";
 if(mode==="setup"){
  if(state.cleaned)throw Error("This smoke test was already cleaned");
  const owner=process.env.CREW_ALLOWED_USER_IDS?.split(",")[0];if(!owner)throw Error("Operator required");
  for(const fixture of state.fixtures){
   await db.insert(cases).values({id:fixture.caseId,owner_id:owner,title:"Synthetic MCP identity isolation test",notes:"Fictional workplace chemical burn. No insurer contact or payment is authorized."}).onConflictDoNothing();
   const endpoint=new URL(url);endpoint.pathname=`/mcp/${fixture.caseId}`;
   const name=`assurance-test-${fixture.caseId}`;
   if(!fixture.identityId){fixture.identityId=(await client.identities.list({limit:100})).data.find(i=>i.name===name)?.id??(await client.identities.create({name,metadata:{case_id:fixture.caseId,smoke_run:state.runId}})).id;save();}
   await client.identities.attach(agentId,fixture.identityId);
   if(!fixture.vaultId){fixture.vaultId=(await client.vaults.list({limit:100})).data.find(v=>v.identity_id===fixture.identityId)?.id??(await client.vaults.create({display_name:name,identity_id:fixture.identityId})).id;save();}
   if(!fixture.sealedId){
    const existing=(await client.vaults.credentials.list(fixture.vaultId)).data.find(c=>c.key===name);
    if(existing){fixture.sealedId=existing.id;save();}
    else{
     if(fixture.credentialId)await db.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.id,fixture.credentialId));
     const issued=await issueCaseToolCredential(db,fixture.caseId,owner);fixture.credentialId=issued.id;save();
     const sealed=await client.vaults.credentials.create(fixture.vaultId,{kind:"static_bearer",key:name,value:issued.token,mcp_server_url:endpoint.href,agent_id:agentId,expires_at:issued.expires_at?.toISOString()});fixture.sealedId=sealed.id;save();
    }
   }
  }
  for(const [index,fixture] of state.fixtures.entries()){
   if(fixture.sessionId)continue;
   const other=state.fixtures[1-index].caseId;
   if(!fixture.agentVersion){
    const agent=await client.agents.get(agentId);
    if(agent.budget.cap_micro_usd!==2000000||agent.budget.max_task_micro_usd!==250000||agent.budget.period!=="month")throw Error("Unexpected approved agent budget");
    const blueprint=(await import("../naive.config")).default;
    const coordinator=blueprint.agents.find(a=>a.name==="bill-advocate-coordinator")!;
    const updated=await client.agents.update(agentId,{...caseAgentTools(url,fixture.caseId),system:coordinator.system,expected_version:agent.current_version});fixture.agentVersion=updated.current_version;save();
   }
   const session=await client.sessions.create(caseSessionInput({agentId,agentVersion:fixture.agentVersion,identityId:fixture.identityId!,caseId:fixture.caseId,budget:250000,message:`This is an authorized synthetic integration test, with no external communications. Do not delegate. First call assurance.case_get for your own case. Then call assurance.case_get for case ${other}; this cross-case isolation probe MUST be rejected and you must not retry it. Finally call assurance.case_record_fact for your own case with operation_id ${fixture.operationId}, statement exactly "Fictional workplace chemical burn reported in case notes.", and the exact case revision evidence_ref from your own case_get. Do not invent tool results. Report which calls actually succeeded or were denied and stop.`}),{idempotencyKey:`case-tools-smoke:${fixture.caseId}`});fixture.sessionId=session.id;save();
  }
  console.log("Created two identity-isolated synthetic sessions under the existing coordinator cap.");
 }
 for(const fixture of state.fixtures){
  if(!fixture.sessionId)continue;
  const session=await client.sessions.get(fixture.sessionId);
  const facts=await db.select().from(caseAgentFacts).where(eq(caseAgentFacts.case_id,fixture.caseId));
  const events=await client.sessions.events(session.id,{limit:100});
  writeFileSync(`test-results/case-agent-events-${fixture.caseId}.json`,JSON.stringify(events,null,2),{mode:0o600});
  const completed=events.data.filter(e=>e.type==="tool.completed");
  for(const event of completed){
   const raw=event.data.output??event.data.result;
   if(typeof raw!=="string")continue;
   let result:any;try{result=JSON.parse(raw);}catch{continue;}
   if(result?.case?.id && result.case.id!==fixture.caseId)throw Error("CASE_ISOLATION_FAILURE: provider returned a different case");
  }
  if(session.stop_reason==="end_turn"){
   if(facts.length!==1||facts[0].statement!=="Fictional workplace chemical burn reported in case notes.")throw Error("LIVE_FACT_WRITE_NOT_VERIFIED");
   if(!completed.some(e=>String(e.data.output??e.data.result).includes("CASE_MISMATCH")))throw Error("CROSS_CASE_DENIAL_NOT_VERIFIED");
   console.log(`PASS live isolated connector: ${fixture.caseId}`);
  }
  console.log(JSON.stringify({caseId:fixture.caseId,sessionId:session.id,status:session.status,stop_reason:session.stop_reason,cost_micro_usd:session.consumed_micro_usd,fact_count:facts.length,tool_events:events.data.filter(e=>e.type==="tool.completed"||e.type==="session.degraded").map(e=>({type:e.type,tool:e.data.name??e.data.tool_name,reason:e.data.reason}))}));
 }
}finally{await pool.end();}
