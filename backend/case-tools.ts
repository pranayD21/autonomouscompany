import {outcomeInput,type OutcomeInput} from "./case-outcome";
import type {CaseDecision} from "./autonomy-policy";
import {Hono,type Context} from "hono";
import {bodyLimit} from "hono/body-limit";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {z} from "zod";
export type CaseToolIdentity={id:string;case_id:string;owner_id:string};
export type CaseToolDependencies={
 recordOutcome?:(identity:CaseToolIdentity,input:OutcomeInput)=>Promise<unknown>;
 authenticate:(token:string)=>Promise<CaseToolIdentity|null>;
 getCase:(identity:CaseToolIdentity)=>Promise<unknown>;
 takeAction?:(identity:CaseToolIdentity,input:{operation_id:string;authority_id:string;decision:CaseDecision;channel?:"email"|"call"})=>Promise<unknown>;
 citeSource?:(identity:CaseToolIdentity,input:{operation_id:string;url:string;quote:string})=>Promise<unknown>;
 recordFact:(identity:CaseToolIdentity,input:{operation_id:string;statement:string;source_ref:string})=>Promise<unknown>;
};
const textResult=(value:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(value)}]});
export function caseTools(deps:CaseToolDependencies){
 const app=new Hono();app.use("*",bodyLimit({maxSize:32768}));
 const handle=async (c:Context)=>{
  // These are server-to-server tools, not browser endpoints.
  if(c.req.header("origin"))return c.json({error:"Browser origins are not accepted."},403);
  const header=c.req.header("authorization");
  if(!header?.startsWith("Bearer "))return c.json({error:"Case credential required."},401);
  const identity=await deps.authenticate(header.slice(7));
  if(!identity)return c.json({error:"Invalid or expired case credential."},401);
  if(c.req.param("caseId") && identity.case_id!==c.req.param("caseId"))return c.json({error:"Credential does not belong to this case."},403);
  if(c.req.method!=="POST")return c.body(null,405,{Allow:"POST"});
  const server=new McpServer({name:"assurance",version:"0.1.0"});
  server.registerTool("case_get",{description:"Read this case and its evidence. Reported information is not a verified outcome.",inputSchema:{case_id:z.uuid()}},async input=>{
   if(input.case_id!==identity.case_id)return {...textResult({error:"CASE_MISMATCH"}),isError:true};
   return textResult(await deps.getCase(identity));
  });
  server.registerTool("case_record_fact",{description:"Record a sourced statement, not independent verification. Reuse operation_id when retrying.",inputSchema:{case_id:z.uuid(),operation_id:z.uuid(),statement:z.string().trim().min(1).max(4000),source_ref:z.string().trim().min(1).max(200)}},async input=>{
   if(input.case_id!==identity.case_id)return {...textResult({error:"CASE_MISMATCH"}),isError:true};
   try{return textResult(await deps.recordFact(identity,input));}catch{return {...textResult({error:"FACT_NOT_SAVED",message:"Check source_ref and operation_id against case_get; do not invent evidence."}),isError:true};}
  });
  if(deps.recordOutcome)server.registerTool("record_outcome",{description:"Record the agent's calculated outcome with exact quotes from confirmed documents or accepted replies. Use integer USD cents and null for unknown amounts. Separate reductions from refunds actually received. Quote matching is not independent verification; this does not close the case or charge a fee.",inputSchema:{case_id:z.uuid(),...outcomeInput.shape}},async ({case_id,...input})=>{
   if(case_id!==identity.case_id)return {...textResult({error:"CASE_MISMATCH"}),isError:true};
   try{return textResult(await deps.recordOutcome!(identity,input));}catch{return {...textResult({error:"OUTCOME_NOT_SAVED",message:"Use exact quotes from current confirmed documents or accepted replies. Reuse operation_id for identical retries only."}),isError:true};}
  });
  if(deps.citeSource)server.registerTool("cite_source",{description:"Fetch a public source and verify a short exact quote. Does not verify legal applicability. Use only public URLs; never include private case details in URLs.",inputSchema:{case_id:z.uuid(),operation_id:z.uuid(),url:z.url().max(2000),quote:z.string().min(12).max(1000)}},async input=>{
   if(input.case_id!==identity.case_id)return {...textResult({error:"CASE_MISMATCH"}),isError:true};
   try{return textResult(await deps.citeSource!(identity,input));}catch{return {...textResult({error:"SOURCE_NOT_SAVED",message:"Public HTTPS source and an exact quote of at most 25 words required. Reuse the saved citation for an already cited text; do not invent evidence."}),isError:true};}
  });
  if(deps.takeAction){
   const common={case_id:z.uuid(),operation_id:z.uuid(),authority_id:z.uuid(),reason:z.string().trim().min(1).max(1200),evidence_refs:z.array(z.string().min(1).max(150)).max(20)};
   const perform=async(input:{case_id:string;operation_id:string;authority_id:string},decision:CaseDecision,channel?:"email"|"call")=>{
    if(input.case_id!==identity.case_id)return {...textResult({error:"CASE_MISMATCH"}),isError:true};
    try{return textResult(await deps.takeAction!(identity,{operation_id:input.operation_id,authority_id:input.authority_id,decision,channel}));}
    catch{return {...textResult({error:"ACTION_NOT_COMPLETED",message:"Check the current standing authority, limits, channel, and pending operation in case_get. Reuse operation_id for retries; never redial an uncertain call."}),isError:true};}
   };
   for(const [name,channel] of [["send_email","email"],["place_call","call"]] as const)server.registerTool(name,{description:"Contact a standing-authority contact. No arbitrary destination. Reuse operation_id for retries and inspect the returned action state/receipt before claiming contact occurred.",inputSchema:{...common,contact_id:z.string(),role:z.enum(["customer","insurer"]),subject:z.string().trim().min(1).max(160).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(1).max(4000)}},async input=>perform(input,{tool:input.role==="customer"?"contact_customer":"contact_insurer",contact_id:input.contact_id,subject:input.subject,body:input.body,reason:input.reason,evidence_refs:input.evidence_refs},channel));
   server.registerTool("schedule_followup",{description:"Choose when this case should be reconsidered, subject to its existing authority and limits.",inputSchema:{...common,minutes:z.number().int().min(5).max(10080)}},async input=>perform(input,{tool:"wait_for_reply",minutes:input.minutes,reason:input.reason,evidence_refs:input.evidence_refs}));
   server.registerTool("request_human",{description:"Stop autonomous progress and record the specific human help needed.",inputSchema:{...common,question:z.string().trim().min(1).max(1000)}},async input=>perform(input,{tool:"request_human_help",question:input.question,reason:input.reason,evidence_refs:input.evidence_refs}));
   server.registerTool("stop_case",{description:"Stop this case. Synthetic demo completion requires a current recorded outcome reference and does not verify a real claim or payout. Real goal success requires verified outcome evidence; do not claim savings from a sent message.",inputSchema:{...common,outcome:z.enum(["goal_met","synthetic_demo_completed","no_supported_next_step","customer_requested_stop"]),summary:z.string().trim().min(1).max(1600)}},async input=>perform(input,{tool:"stop_case",outcome:input.outcome,summary:input.summary,reason:input.reason,evidence_refs:input.evidence_refs}));
  }
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  try {const response=await transport.handleRequest(c.req.raw);c.header("Cache-Control","no-store");return response;}
  finally {await server.close();}
 };
 app.all("/mcp",handle);app.all("/mcp/:caseId",handle);
 app.onError(()=>Response.json({error:"Case tool temporarily unavailable."},{status:503}));return app;
}
