import {createHash} from "node:crypto";
import {z} from "zod";
import type {OutreachAction} from "../schema";
export type CallTurn={role:"user"|"agent";text:string;time?:string|number};
export type CallEvidence={provider:"agentphone"|"elevenlabs";provider_id:string;turns:CallTurn[];sha256:string};
const message=z.string().max(10000);
export function parseCallEvidence(provider:CallEvidence["provider"],receipt:string,data:unknown):CallEvidence|null{
 let turns:CallTurn[];
 if(provider==="elevenlabs"){
  const parsed=z.object({conversation_id:z.string(),status:z.string(),transcript:z.array(z.object({role:z.enum(["user","agent"]),message:message.nullable().optional(),time_in_call_secs:z.number().finite().nonnegative().optional()})).max(1000).optional()}).parse(data);
  if(`elevenlabs:${parsed.conversation_id}`!==receipt)throw Error("CALL_RECEIPT_MISMATCH");
  if(parsed.status!=="done"||!parsed.transcript?.length)return null;
  turns=parsed.transcript.filter(t=>t.message?.trim()).map(t=>({role:t.role,text:t.message!,...(t.time_in_call_secs!==undefined?{time:t.time_in_call_secs}:{})}));
 }else{
  const parsed=z.object({id:z.string(),status:z.string(),transcripts:z.array(z.object({transcript:message.nullable().optional(),response:message.nullable().optional(),createdAt:z.iso.datetime({offset:true}).optional()})).max(1000).optional()}).parse(data);
  if(parsed.id!==receipt)throw Error("CALL_RECEIPT_MISMATCH");
  if(parsed.status!=="completed"||!parsed.transcripts?.length)return null;
  turns=parsed.transcripts.flatMap(t=>[...(t.transcript?.trim()?[{role:"user" as const,text:t.transcript,...(t.createdAt?{time:t.createdAt}:{})}]:[]),...(t.response?.trim()?[{role:"agent" as const,text:t.response,...(t.createdAt?{time:t.createdAt}:{})}]:[])]);
 }
 if(!turns.length)return null;
 const canonical=JSON.stringify({provider,provider_id:receipt,turns});if(Buffer.byteLength(canonical)>100000)throw Error("CALL_TRANSCRIPT_TOO_LARGE");
 return {provider,provider_id:receipt,turns,sha256:createHash("sha256").update(canonical).digest("hex")};
}
export async function readCallEvidence(action:OutreachAction,request:typeof fetch=fetch){
 if(action.kind!=="call"||!action.provider_id||action.state!=="submitted")throw Error("CALL_RECEIPT_REQUIRED");
 const eleven=action.provider_id.startsWith("elevenlabs:"),id=eleven?action.provider_id.slice(11):action.provider_id;
 const key=process.env[eleven?"ELEVENLABS_API_KEY":"AGENTPHONE_API_KEY"];if(!key)throw Error("CALL_PROVIDER_NOT_CONFIGURED");
 const response=await request(eleven?`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}`:`https://api.agentphone.ai/v1/calls/${encodeURIComponent(id)}`,{headers:eleven?{"xi-api-key":key}:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`CALL_PROVIDER_HTTP_${response.status}`);
 const reader=response.body?.getReader();if(!reader)throw Error("CALL_PROVIDER_EMPTY");
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000)throw Error("CALL_PROVIDER_TOO_LARGE");chunks.push(value);}}finally{await reader.cancel();}
 return parseCallEvidence(eleven?"elevenlabs":"agentphone",action.provider_id,JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
