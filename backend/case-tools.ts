import {Hono,type Context} from "hono";
import {bodyLimit} from "hono/body-limit";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {z} from "zod";
export type CaseToolIdentity={id:string;case_id:string;owner_id:string};
export type CaseToolDependencies={
 authenticate:(token:string)=>Promise<CaseToolIdentity|null>;
 getCase:(identity:CaseToolIdentity)=>Promise<unknown>;
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
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  try {const response=await transport.handleRequest(c.req.raw);c.header("Cache-Control","no-store");return response;}
  finally {await server.close();}
 };
 app.all("/mcp",handle);app.all("/mcp/:caseId",handle);
 app.onError(()=>Response.json({error:"Case tool temporarily unavailable."},{status:503}));return app;
}
