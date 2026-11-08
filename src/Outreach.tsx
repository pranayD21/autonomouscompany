import {useEffect,useState,type FormEvent} from "react";
import {api} from "./services";
import type {OutreachAction,CaseReply,ReplyMonitor} from "../backend/schema";
type Monitor=ReplyMonitor&{persistent?:boolean};
const monitoring=(m:Monitor)=>m.enabled&&(m.persistent||new Date(m.expires_at)>new Date());
export function Outreach({caseId,userId,enabled,plan,revision,canDraft=true}:{caseId:string;userId:string;enabled:boolean;plan:string;revision:number;canDraft?:boolean}) {
 const [replyData,setReplyData]=useState<{replies:CaseReply[];has_more:boolean}>({replies:[],has_more:false});
 const [notice,setNotice]=useState("");
 const [actions,setActions]=useState<OutreachAction[]>([]);
 const [monitors,setMonitors]=useState<Monitor[]>([]);
 const [kind,setKind]=useState<"call"|"email">("email");
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const path=`/cases/${caseId}/actions`;
 async function refresh(){const [actions,replies,monitors]=await Promise.all([api<OutreachAction[]>(path,{},userId),api<{replies:CaseReply[];has_more:boolean}>(`/cases/${caseId}/replies`,{},userId),api<Monitor[]>(`/cases/${caseId}/reply-monitors`,{},userId)]);setActions(actions);setReplyData(replies);setMonitors(monitors);}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[caseId,userId,revision]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const f=new FormData(form);setBusy(true);setError("");
  try {await api(path,{method:"POST",body:JSON.stringify({id:requestId,kind,destination:f.get("destination"),subject:f.get("subject"),body:f.get("body"),synthetic:true})},userId);setRequestId(crypto.randomUUID());await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Could not save draft");}finally{setBusy(false);}
 }
 async function act(action:OutreachAction,authorize:boolean){
  if(authorize&&!window.confirm(action.kind==="call"
   ?`Authorize one AI demo call to ${action.destination} using the saved discussion plan? Confirm the recipient agreed to this call. Audio recording is disabled; The configured voice provider processes the conversation and may retain a transcript. Use fictional details only.`
   :`Authorize one email to ${action.destination} with the saved subject and text? Confirm this recipient agreed to the synthetic test.`))return;
  setBusy(true);setError("");try{await api(`${path}/${action.id}/${authorize?"authorize":"refresh"}`,{method:"POST",body:JSON.stringify({authorize:true,synthetic:true})},userId);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Action unavailable");}finally{setBusy(false);}
 }
 async function sync(action:OutreachAction){setBusy(true);setError("");setNotice("");try{const result=await api<{imported:number;changed:number;held:number;partial:boolean}>(`${path}/${action.id}/replies/sync`,{method:"POST"},userId);setNotice(`${result.imported} new reply(s); ${result.held} held for review.${result.partial?" More thread history remains at the provider.":""} No email was sent.`);await refresh();}catch(e){setError(e instanceof Error?e.message:"Reply check failed");}finally{setBusy(false);}}
 async function monitor(action:OutreachAction,enabled:boolean){setBusy(true);setError("");try{await api(`${path}/${action.id}/reply-monitor`,{method:"POST",body:JSON.stringify({enabled})},userId);setNotice(enabled?"Reply monitoring enabled for 30 days. Checks run about every 15 minutes. No messages or agent reviews are sent automatically.":"Reply monitoring paused. A check already in progress may finish.");await refresh();}catch(e){setError(e instanceof Error?e.message:"Monitoring could not be changed");}finally{setBusy(false);}}
 return <div className="outreach"><p className="quiet-line">Write a draft, then approve it. Nothing is sent until you do.</p>
 {!canDraft&&<p className="quiet-line">Messages the agent sends appear here.</p>}

 {notice&&<p role="status">{notice}</p>}
 {error&&<p role="alert">{error}</p>}
 {actions.map(action=><div className="outreach-draft" key={action.id} data-action-id={action.id} data-state={action.state}>
  <h4>{action.kind==="call"?"AI call":"Email"}: {action.subject}</h4><p>To: {action.destination}</p><p className="outreach-body">{action.body}</p>
  <p>Case revision: {action.case_revision}{action.case_revision!==revision?" · Earlier case details":""}</p><p>Status: {action.state}{action.provider_status?` · ${action.provider_status}`:""}{action.duration_seconds!=null?` · ${action.duration_seconds} seconds`:""}</p>
  {action.approved_at&&<small>Authorized {new Date(action.approved_at).toLocaleString()}</small>}
  {["unknown","dispatching"].includes(action.state)&&<p>Do not send again. Check the provider before taking another action; the outcome may be uncertain.</p>}
  {action.error_code&&<p>Provider result: {action.error_code}</p>}
  <div className="actions">{action.state==="draft"&&<button disabled={busy||!enabled||action.case_revision!==revision} onClick={()=>void act(action,true)}>{action.kind==="call"?"Review and authorize call":"Review and authorize email"}</button>}
  {action.provider_id&&<button className="text-button" disabled={busy} onClick={()=>void act(action,false)}>Check provider status</button>}
  {action.kind==="email"&&action.provider_thread_id&&action.approved_at&&<><button className="text-button" disabled={busy} onClick={()=>void sync(action)}>Check replies</button><button className="text-button" disabled={busy} onClick={()=>void monitor(action,!monitors.some(m=>m.action_id===action.id&&monitoring(m)))}>{monitors.some(m=>m.action_id===action.id&&monitoring(m))?"Pause reply monitoring":"Monitor replies"}</button></>}</div>
  {monitors.filter(m=>m.action_id===action.id).map(m=><div key={m.action_id}><p>Automatic checks: {monitoring(m)?"On":"Paused or expired"}{m.last_success_at?` · Last successful check ${new Date(m.last_success_at).toLocaleString()}`:" · No scheduled check completed yet"}</p>{monitoring(m)&&<small>Next check due {new Date(m.next_check_at).toLocaleString()} · {m.persistent?"Monitoring continues while this case is open":`Monitoring ends ${new Date(m.expires_at).toLocaleDateString()}`}</small>}{m.error_code&&<p>{m.error_code==="PARTIAL_HISTORY"?"Only part of the thread history was available.":"The last scheduled check failed. It will retry with a longer delay."}</p>}</div>)}
 </div>)}
 {canDraft&&<form className="new-draft" onSubmit={create}>{actions.length>0&&<h4>Write a new draft</h4>}
  <label>Outreach channel<select value={kind} onChange={e=>setKind(e.target.value as "call"|"email")}><option value="email">Email</option><option value="call">AI phone call</option></select></label>
  <label>{kind==="call"?"Recipient phone (E.164)":"Recipient email"}<input name="destination" type={kind==="call"?"tel":"email"} required maxLength={254}/></label>
  <label>Subject or call purpose<input name="subject" defaultValue="Assurance synthetic claim — document questions" required maxLength={160}/></label>
  <label htmlFor={`outreach-body-${caseId}`}>{kind==="call"?"Discussion plan":"Email text"}</label><textarea id={`outreach-body-${caseId}`} name="body" defaultValue={`This is a synthetic insurance-claim demo, not a real patient case.\n\n${plan}`} required maxLength={4000} rows={6}/>
  <button disabled={busy}>Save outreach draft</button>
 </form>}
 <h4>Received correspondence</h4><p className="caveat">Replies are what they said, not proof of coverage or payment.</p>{replyData.has_more&&<p>Showing the latest 100 replies.</p>}{replyData.replies.length===0&&<p className="quiet-line">No replies yet.</p>}
 {replyData.replies.map(reply=><article key={reply.id} id={`reply-${reply.id}`} className="reply-card" data-disposition={reply.disposition}><h5>{reply.subject||"Reply without subject"}</h5><p>From: {reply.sender} · {new Date(reply.received_at).toLocaleString()}</p><p>{reply.disposition==="accepted"?"Included as reported information":"Held — not included in agent review"}</p><small>{reply.reason}</small><p className="outreach-body">{reply.body||"No supported plain-text body."}</p>{reply.attachment_count>0&&<p>{reply.attachment_count} attachment(s) not imported or read.</p>}</article>)}
 </div>;
}
