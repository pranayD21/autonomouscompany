import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {eq,inArray,sql} from "drizzle-orm";
import {cases,caseAuthorities,caseAgentSessions,caseToolCredentials} from "../backend/schema";
import {provisionCaseSession,type ProvisionInput} from "../backend/provision-case-session";
import type {naiveClient} from "../backend/providers/naive";
if(!process.env.OUTREACH_TEST_DATABASE_URL)throw Error("Disposable branch required");
const pool=new Pool({connectionString:process.env.OUTREACH_TEST_DATABASE_URL.replace("sslmode=require","sslmode=verify-full"),max:3}),db=drizzle(pool),ids:string[]=[],owner=randomUUID();process.env.CREW_ALLOWED_USER_IDS=owner;
before(async()=>{await migrate(db,{migrationsFolder:"drizzle"});});
after(async()=>{if(ids.length){await db.delete(caseAgentSessions).where(inArray(caseAgentSessions.case_id,ids));await db.delete(caseToolCredentials).where(inArray(caseToolCredentials.case_id,ids));await db.delete(caseAuthorities).where(inArray(caseAuthorities.case_id,ids));await db.delete(cases).where(inArray(cases.id,ids));}await pool.end();});
async function fixture():Promise<ProvisionInput>{
 const [item]=await db.insert(cases).values({owner_id:owner,title:"Synthetic provisioning test"}).returning();ids.push(item.id);
 const [authority]=await db.insert(caseAuthorities).values({case_id:item.id,approved_by:owner,policy:{synthetic:true,goal:"Gather fictional facts",contacts:[],max_decisions:3,max_outbound:0,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()}}).returning();
 return {caseId:item.id,authorityId:authority.id,owner,agentId:"agt_test",generalVersion:21,toolsUrl:"https://example.com/mcp"};
}
function provider(metadata:Record<string,unknown>={}){
 const base={version:21,current_version:21,system:"Synthetic test",metadata,mcp_servers:[],tools:{default_config:{permission:"deny"}},budget:{period:"month",cap_micro_usd:2000000,max_task_micro_usd:250000}};
 let current:any=structuredClone(base),seq=21,calls=0,failPublish=false;
 const versions:any[]=[structuredClone(base)],identities:any[]=[],vaults:any[]=[],sealed:any[]=[];
 const page=(data:any[])=>({data,has_more:false,next_cursor:null});
 const client={agents:{getVersion:async(_id:string,v:number)=>{calls++;return structuredClone(versions.find(x=>x.version===v));},get:async()=>structuredClone(current),listVersions:async()=>page(structuredClone(versions)),update:async(_id:string,patch:any)=>{assert.equal(patch.expected_version,current.current_version);current={...current,...patch,version:++seq,current_version:seq};versions.push(structuredClone(current));if(failPublish){failPublish=false;throw Error("Publication response lost");}return structuredClone(current);},rollback:async(_id:string,input:any)=>{assert.equal(input.expected_version,current.current_version);current={...structuredClone(versions.find(v=>v.version===input.to_version)),version:++seq,current_version:seq};versions.push(structuredClone(current));return current;}},
 identities:{list:async()=>page(identities),create:async(input:any)=>{const value={...input,id:`idn_${randomUUID()}`};identities.push(value);return value;},attach:async()=>{},agents:async()=>page([{id:"agt_test"}])},
 vaults:{list:async()=>page(vaults),create:async(input:any)=>{const value={...input,id:`vlt_${randomUUID()}`};vaults.push(value);return value;},credentials:{list:async()=>page(sealed),create:async(_id:string,input:any)=>{const {value,...metadata}=input;assert.match(value,/^assurance_case_/);const result={...metadata,id:randomUUID()};sealed.push(result);return result;},delete:async(_id:string,id:string)=>{sealed.splice(sealed.findIndex(v=>v.id===id),1);}}}};
 return {client:client as unknown as ReturnType<typeof naiveClient>,identities,vaults,sealed,versions,current:()=>current,calls:()=>calls,newGeneral:()=>{current={...structuredClone(base),system:"Newer general configuration",version:++seq,current_version:seq};versions.push(structuredClone(current));},failPublish:()=>{failPublish=true;}};
}
test("approved setup registers once without resetting grant limits or creating another identity",async()=>{
 const input=await fixture(),p=provider();
 const first=await provisionCaseSession(db,input,p.client);const again=await provisionCaseSession(db,input,p.client);
 assert.equal(first.id,again.id);assert.equal(first.state,"starting");assert.equal(p.identities.length,1);assert.equal(p.vaults.length,1);assert.equal(p.sealed.length,1);assert.deepEqual(p.current().mcp_servers,[]);
 assert.equal(p.versions.find(v=>v.version===first.agent_version).mcp_servers[0].url,`${input.toolsUrl}/${input.caseId}`);
 const [authority]=await db.select().from(caseAuthorities).where(eq(caseAuthorities.id,input.authorityId));assert.equal(authority.policy.max_decisions,3);assert.equal(authority.policy.max_outbound,0);assert.equal(authority.state,"active");
});
test("wrong owner and inactive authority fail before any provider work",async()=>{
 const input=await fixture(),p=provider();await assert.rejects(()=>provisionCaseSession(db,{...input,owner:"other"},p.client),/INVALID_CASE_BINDING/);
 await db.update(caseAuthorities).set({state:"revoked"}).where(eq(caseAuthorities.id,input.authorityId));await assert.rejects(()=>provisionCaseSession(db,input,p.client),/ACTIVE_SYNTHETIC_AUTHORITY_REQUIRED/);assert.equal(p.calls(),0);
});
test("lost publication response rolls back credentials and resumes the same remote identity/version",async()=>{
 const input=await fixture(),p=provider();p.failPublish();await assert.rejects(()=>provisionCaseSession(db,input,p.client),/Publication response lost/);
 assert.equal((await db.select().from(caseToolCredentials).where(eq(caseToolCredentials.case_id,input.caseId))).length,0);
 assert.equal((await db.select().from(caseAgentSessions).where(eq(caseAgentSessions.case_id,input.caseId))).length,0);assert.deepEqual(p.current().mcp_servers,[]);
 const oldSealed=p.sealed[0].id;
 const result=await provisionCaseSession(db,input,p.client);assert.equal(result.agent_version,22);assert.equal(p.identities.length,1);assert.equal(p.vaults.length,1);assert.equal(p.sealed.length,1);assert.notEqual(p.sealed[0].id,oldSealed);
 assert.equal(p.versions.filter(v=>v.metadata.assurance_authority===input.authorityId).length,1);
});

test("restoration preserves a newer general default instead of rolling it back to the pinned base",async()=>{
 const input=await fixture(),p=provider();p.newGeneral();
 await provisionCaseSession(db,input,p.client);
 assert.equal(p.current().system,"Newer general configuration");assert.deepEqual(p.current().mcp_servers,[]);
});


test("open permission provisions without operator/expiry constraints and seals a non-expiring credential",async()=>{
 const input=await fixture(),p=provider();
 await db.execute(sql`UPDATE advocacy_case_authorities SET policy=${JSON.stringify({version:2,consent:"Handle my claim and ask me for needed details."})}::jsonb WHERE id=${input.authorityId}`);
 const priorAllowed=process.env.CREW_ALLOWED_USER_IDS,priorBudget=process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD;
 process.env.CREW_ALLOWED_USER_IDS="";process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD="9000000";
 try{
  const run=await provisionCaseSession(db,input,p.client);
  const pinned=p.versions.find(v=>v.version===run.agent_version);
  assert.equal(pinned.budget.max_task_micro_usd,9000000);assert.equal(pinned.budget.cap_micro_usd,9000000);
  const [credential]=await db.select().from(caseToolCredentials).where(eq(caseToolCredentials.id,run.credential_id));
  assert.equal(credential.expires_at,null);assert.equal(p.sealed[0].expires_at,undefined);
  assert.deepEqual(p.current().mcp_servers,[]);assert.equal(p.current().budget.max_task_micro_usd,250000);
  assert.equal((await provisionCaseSession(db,input,p.client)).id,run.id);
 }finally{
  if(priorAllowed===undefined)delete process.env.CREW_ALLOWED_USER_IDS;else process.env.CREW_ALLOWED_USER_IDS=priorAllowed;
  if(priorBudget===undefined)delete process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD;else process.env.NAIVE_OPEN_SESSION_BUDGET_MICRO_USD=priorBudget;
 }
});


test("case-owned general agent metadata is not mistaken for its published case connector",async()=>{
 const input=await fixture(),p=provider({assurance_case:input.caseId,assurance_authority:input.authorityId});
 await db.execute(sql`UPDATE advocacy_case_authorities SET policy=${JSON.stringify({version:2,consent:"Authorize the firm to hire this advocate."})}::jsonb WHERE id=${input.authorityId}`);
 const run=await provisionCaseSession(db,{...input,budgetMicroUsd:50000},p.client);
 assert.notEqual(run.agent_version,input.generalVersion);
 const pinned=p.versions.find(v=>v.version===run.agent_version);
 assert.equal(pinned.mcp_servers[0].url,`${input.toolsUrl}/${input.caseId}`);
 assert.equal(p.current().metadata.assurance_authority,input.authorityId);
 assert.deepEqual(p.current().mcp_servers,[]);
 assert.equal((await provisionCaseSession(db,{...input,budgetMicroUsd:50000},p.client)).id,run.id);
 assert.equal(p.identities.length,1);assert.equal(p.sealed.length,1);
});
