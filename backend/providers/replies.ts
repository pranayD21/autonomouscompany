import {z} from "zod";
import {createHash} from "node:crypto";
import type {OutreachAction} from "../schema";
const messageSchema=z.object({inbox_id:z.string(),thread_id:z.string(),message_id:z.string().min(1).max(1000),labels:z.array(z.string()),timestamp:z.iso.datetime({offset:true}),from:z.string().max(1000),to:z.array(z.string()),subject:z.string().optional(),text:z.string().optional(),extracted_text:z.string().optional(),in_reply_to:z.string().optional(),references:z.array(z.string()).optional(),attachments:z.array(z.unknown()).optional(),authentication_results:z.object({dmarc:z.string().optional(),dmarc_domain:z.string().optional(),dkim:z.string().optional(),dkim_domain:z.string().optional()}).optional(),agent_armor:z.object({status:z.string(),verdict:z.string().optional()}).optional()});
const threadSchema=z.object({inbox_id:z.string(),thread_id:z.string(),messages:z.array(messageSchema).max(100),next_page_token:z.string().nullable().optional()});
export const mailbox=(value:string)=>{if((value.match(/@/g)??[]).length!==1)return null;const address=(value.match(/^[^<>]*<([^<>]+)>$/)?.[1]??value).trim().toLowerCase();return z.email().safeParse(address).success?address:null;};
export type ImportedReply={inbox_id:string;message_id:string;thread_id:string;sender:string;subject:string;body:string;sha256:string;disposition:"accepted"|"held";reason:string;attachment_count:number;received_at:Date};
export function normalizeReply(raw:z.infer<typeof messageSchema>,action:OutreachAction,inbox:string):ImportedReply|null{
 if(raw.inbox_id!==inbox||raw.thread_id!==action.provider_thread_id)throw new Error("REPLY_THREAD_MISMATCH");
 if(!raw.labels.includes("received")||raw.message_id===action.provider_id)return null;
 const sender=mailbox(raw.from);const domain=sender?.split("@")[1];
 const auth=raw.authentication_results;
 const domainAuthenticated=!!domain&&((auth?.dmarc==="pass"&&auth.dmarc_domain?.toLowerCase()===domain)||(auth?.dkim==="pass"&&auth.dkim_domain?.toLowerCase()===domain));
 const linked=raw.in_reply_to===action.provider_id||!!raw.references?.includes(action.provider_id!);
 const text=(raw.extracted_text?.trim()?raw.extracted_text:raw.text??"").replace(/\r\n/g,"\n").trim();
 let reason="Expected sender, authenticated domain, and reply reference matched. Content remains an unverified report.";
 if(!sender||sender!==mailbox(action.destination))reason="Sender does not match the authorized email recipient.";
 else if(!raw.to.some(to=>mailbox(to)===mailbox(inbox)))reason="The configured inbox is not an explicit recipient.";
 else if(!linked)reason="Reply reference does not connect to the authorized message.";
 else if(raw.labels.some(l=>["unauthenticated","spam","blocked"].includes(l))||!domainAuthenticated)reason="Sender-domain authentication is missing or flagged.";
 else if(raw.agent_armor&&(raw.agent_armor.status!=="complete"||raw.agent_armor.verdict!=="clear"))reason="Provider content screening is pending, unavailable, or flagged.";
 else if(!text||text.length>16000)reason="Plain-text content is missing or exceeds the supported limit.";
 const disposition=reason.startsWith("Expected sender")?"accepted":"held";
 const subject=(raw.subject??"").slice(0,500);
 const hash=createHash("sha256").update(JSON.stringify({message_id:raw.message_id,sender:raw.from,subject:raw.subject??"",text,timestamp:raw.timestamp,attachment_count:raw.attachments?.length??0})).digest("hex");
 return {inbox_id:inbox,message_id:raw.message_id,thread_id:raw.thread_id,sender:raw.from,subject,body:text.slice(0,16000),sha256:hash,disposition,reason,attachment_count:raw.attachments?.length??0,received_at:new Date(raw.timestamp)};
}
export async function fetchReplies(action:OutreachAction,request:typeof fetch=fetch){
 const inbox=process.env.AGENTMAIL_INBOX_ID;
 if(!inbox||!process.env.AGENTMAIL_API_KEY||action.kind!=="email"||!action.provider_id||!action.provider_thread_id||!action.approved_at)throw new Error("NO_AUTHORIZED_EMAIL_THREAD");
 const replies:ImportedReply[]=[];let token:string|undefined;const tokens=new Set<string>();
 for(let page=0;page<5;page++){
  const url=new URL(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/threads/${encodeURIComponent(action.provider_thread_id)}`);url.searchParams.set("limit","100");if(token)url.searchParams.set("page_token",token);
  const response=await request(url,{headers:{Authorization:`Bearer ${process.env.AGENTMAIL_API_KEY}`},signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!response.ok)throw new Error(`REPLY_READ_HTTP_${response.status}`);
  const reader=response.body?.getReader();if(!reader)throw new Error("REPLY_EMPTY_RESPONSE");const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2*1024*1024)throw new Error("REPLY_RESPONSE_TOO_LARGE");chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  const result=threadSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if(result.inbox_id!==inbox||result.thread_id!==action.provider_thread_id)throw new Error("REPLY_THREAD_MISMATCH");
  for(const message of result.messages){const reply=normalizeReply(message,action,inbox);if(reply)replies.push(reply);}
  if(!result.next_page_token)return {replies,partial:false};
  token=result.next_page_token;if(tokens.has(token))throw new Error("REPLY_PAGINATION_LOOP");tokens.add(token);
 }
 return {replies,partial:true};
}
