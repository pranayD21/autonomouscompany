import {config} from "dotenv";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {eq} from "drizzle-orm";
import {cases,caseAuthorities,caseAgentSessions,caseAgentEvents,caseToolCredentials,caseDecisions,caseAgentFacts,caseSources,caseOutcomes,outreachActions} from "../backend/schema";
import {provisionCaseSession} from "../backend/provision-case-session";
import {advanceCaseAgentSession} from "../backend/case-agent-session";
import {queueCaseAgentEvent} from "../backend/case-agent-events";
import {naiveClient} from "../backend/providers/naive";
config({path:[".env.local",".env"],quiet:true});
const mode=process.argv[2],path=process.env.PERSISTENT_SMOKE_STATE_FILE??"test-results/persistent-live-smoke.json";
const state=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{caseId:randomUUID(),authorityId:randomUUID()};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});save();
if(process.env.NAIVE_SETUP_KEY_FILE)process.env.NAIVE_API_KEY=readFileSync(process.env.NAIVE_SETUP_KEY_FILE,"utf8").trim();
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:2}),db=drizzle(pool),client=naiveClient();
try{
 if(state.cleaned)throw Error("Fixture already cleaned");
 if(mode==="setup"){
  const owner=process.env.CREW_ALLOWED_USER_IDS!.split(",")[0];
  const run=await db.transaction(async tx=>{
   await tx.insert(cases).values({id:state.caseId,owner_id:owner,title:"Synthetic persistent session lifecycle test",notes:"Fictional workplace chemical burn. This is a no-outreach technical test. Read the case, report that you are waiting for a fictional evidence event, and end your turn. Do not delegate, research, write facts, stop the authority, or request human help. On an evidence event read the case again and acknowledge its revision, then end your turn."}).onConflictDoNothing();
   await tx.insert(caseAuthorities).values({id:state.authorityId,case_id:state.caseId,approved_by:owner,policy:{synthetic:true,goal:"Read this synthetic case and wait for its fictional evidence event, then acknowledge the new revision. No external communications.",contacts:[],max_decisions:3,max_outbound:0,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+3600000).toISOString()}}).onConflictDoNothing();
   return provisionCaseSession(tx,{caseId:state.caseId,authorityId:state.authorityId,owner,agentId:process.env.NAIVE_COORDINATOR_ID!,generalVersion:Number(process.env.NAIVE_GENERAL_AGENT_VERSION),toolsUrl:process.env.NAIVE_CASE_TOOLS_URL!},client);
  });state.runId=run.id;state.identityId=run.identity_id;save();console.log("Registered synthetic no-outreach session");
 }else if(mode==="advance"){
  if(!state.runId)throw Error("Setup required");await advanceCaseAgentSession(db,state.runId);
 }else if((mode==="approve-followup"||mode==="approve-read")){
  const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,state.runId));
  const remote=await client.sessions.get(run.session_id!);
  if(remote.pending_actions.length!==1)throw Error("Unexpected pending actions");
  const action=remote.pending_actions[0],args=action.args as Record<string,unknown>;
  if(args.case_id!==state.caseId||(mode==="approve-read"?action.name!=="assurance.case_get":action.name!=="assurance.schedule_followup"||args.authority_id!==state.authorityId||args.minutes!==60))throw Error("Unexpected action");
  await client.sessions.confirmTool(remote.id,{tool_call_id:action.tool_call_id,decision:"allow",scope:"call",reason:"Operator confirms only this known synthetic case read or follow-up timer; no outreach."});
  await db.update(caseAgentSessions).set({state:"running",next_check_at:new Date(Date.now()+300000),reason:null}).where(eq(caseAgentSessions.id,run.id));
  console.log("Approved one known synthetic operation; preserved session and budget");
 }else if(mode==="wake"){
  if(!state.runId)throw Error("Setup required");await db.transaction(async tx=>{
   const [item]=await tx.select().from(cases).where(eq(cases.id,state.caseId)).for("update");
   if(item.revision===1)await tx.update(cases).set({revision:2,notes:item.notes+" Fictional update: Demo Pharma reported that its internal incident reference is SYNTH-002."}).where(eq(cases.id,item.id));
   await queueCaseAgentEvent(tx,state.caseId,"synthetic-lifecycle:2","case_updated",{revision:2});
  });console.log("Queued one synthetic evidence event");
 }else if(mode==="verify"){
  const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,state.runId));
  const evidence=await client.sessions.events(run.session_id!,{limit:100});
  writeFileSync(path.replace(/\.json$/, "")+"-events.json",JSON.stringify(evidence,null,2),{mode:0o600});
  const remote=await client.sessions.get(run.session_id!);
  const reads=evidence.data.filter(e=>e.type==="tool.completed").flatMap(e=>{
   const raw=e.data.output??e.data.result;if(typeof raw!=="string")return [];
   try{const value=JSON.parse(raw);return value.case?[value.case]:[];}catch{return [];}
  });
  const events=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,run.id));
  if(reads.some(c=>c.id!==state.caseId))throw Error("CASE_ISOLATION_FAILURE");
  const evidenceEvents=events.filter(e=>e.event_key==="synthetic-lifecycle:2");
  if(!reads.some(c=>c.revision===2)||evidenceEvents.length!==1||!evidenceEvents[0].delivered_at||remote.stop_reason!=="end_turn")throw Error("PERSISTENT_WAKE_NOT_YET_VERIFIED");
  state.verified={sessionId:run.session_id,acceptedSeq:evidenceEvents[0].accepted_seq,costMicroUsd:remote.consumed_micro_usd,revision:2};save();
  console.log("PASS same persistent session consumed revision 2 after the queued event and ended its turn");
 }else if(mode==="cleanup"){
  await db.update(caseToolCredentials).set({revoked_at:new Date()}).where(eq(caseToolCredentials.case_id,state.caseId));
  await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,state.authorityId));
  const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,state.runId));
  if(run?.session_id)await client.sessions.cancel(run.session_id);
  const vaults=(await client.vaults.list({limit:100})).data.filter(v=>v.identity_id===state.identityId);
  for(const vault of vaults){for(const sealed of (await client.vaults.credentials.list(vault.id,{limit:100})).data)await client.vaults.credentials.delete(vault.id,sealed.id);await client.vaults.delete(vault.id);}
  if(state.identityId){await client.identities.detach(process.env.NAIVE_COORDINATOR_ID!,state.identityId);await client.identities.delete(state.identityId);}
  const outbound=await db.select().from(outreachActions).where(eq(outreachActions.case_id,state.caseId));
  if(outbound.length)throw Error("Unexpected outbound rows; inspect instead of deleting");
  await db.transaction(async tx=>{
   await tx.delete(caseAgentEvents).where(eq(caseAgentEvents.run_id,state.runId));
   await tx.delete(caseAgentSessions).where(eq(caseAgentSessions.id,state.runId));
   await tx.delete(caseDecisions).where(eq(caseDecisions.authority_id,state.authorityId));
   await tx.delete(caseOutcomes).where(eq(caseOutcomes.case_id,state.caseId));
   await tx.delete(caseAgentFacts).where(eq(caseAgentFacts.case_id,state.caseId));
   await tx.delete(caseSources).where(eq(caseSources.case_id,state.caseId));
   await tx.delete(caseToolCredentials).where(eq(caseToolCredentials.case_id,state.caseId));
   await tx.delete(caseAuthorities).where(eq(caseAuthorities.id,state.authorityId));
   await tx.delete(cases).where(eq(cases.id,state.caseId));
  });state.cleaned=true;save();console.log("Synthetic resources cleaned; no outbound rows");
 }else if(mode!=="status")throw Error("Use setup, advance, approve-followup, wake, status, or cleanup");
 if(state.runId&&!state.cleaned){const [run]=await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.id,state.runId));
  const events=await db.select().from(caseAgentEvents).where(eq(caseAgentEvents.run_id,run.id));
  console.log(JSON.stringify({state:run.state,remote_session:run.session_id,events:events.map(e=>({key:e.event_key,delivered:!!e.delivered_at,seq:e.accepted_seq}))}));
  if(run.session_id){const remote=await client.sessions.get(run.session_id);console.log(JSON.stringify({status:remote.status,stop_reason:remote.stop_reason,pending_actions:remote.pending_actions,cost_micro_usd:remote.consumed_micro_usd}));}
 }
}finally{await pool.end();}
