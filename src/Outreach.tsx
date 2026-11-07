import {useEffect,useState,type FormEvent} from "react";
import {api} from "./services";
import type {OutreachAction} from "../backend/schema";
export function Outreach({caseId,userId,enabled,plan}:{caseId:string;userId:string;enabled:boolean;plan:string}) {
 const [actions,setActions]=useState<OutreachAction[]>([]);
 const [kind,setKind]=useState<"call"|"email">("email");
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const path=`/cases/${caseId}/actions`;
 async function refresh(){setActions(await api<OutreachAction[]>(path,{},userId));}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[caseId,userId]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;const f=new FormData(form);setBusy(true);setError("");
  try {await api(path,{method:"POST",body:JSON.stringify({id:requestId,kind,destination:f.get("destination"),subject:f.get("subject"),body:f.get("body"),synthetic:true})},userId);setRequestId(crypto.randomUUID());await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Could not save draft");}finally{setBusy(false);}
 }
 async function act(action:OutreachAction,authorize:boolean){
  if(authorize&&!window.confirm(action.kind==="call"
   ?`Authorize one AI demo call to ${action.destination} using the saved discussion plan? Confirm the recipient agreed to this call. Audio recording is disabled; AgentPhone still captures a transcript. Use fictional details only.`
   :`Authorize one email to ${action.destination} with the saved subject and text? Confirm this recipient agreed to the synthetic test.`))return;
  setBusy(true);setError("");try{await api(`${path}/${action.id}/${authorize?"authorize":"refresh"}`,{method:"POST",body:JSON.stringify({authorize:true,synthetic:true})},userId);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Action unavailable");}finally{setBusy(false);}
 }
 return <section className="analysis"><h4>Outreach</h4><p>Save a discussion plan or email, then review it before authorizing one action. Only approved test recipients can be contacted.</p>
 <form onSubmit={create}>
  <label>Outreach channel<select value={kind} onChange={e=>setKind(e.target.value as "call"|"email")}><option value="email">Email</option><option value="call">AI phone call</option></select></label>
  <label>{kind==="call"?"Recipient phone (E.164)":"Recipient email"}<input name="destination" type={kind==="call"?"tel":"email"} required maxLength={254}/></label>
  <label>Subject or call purpose<input name="subject" defaultValue="Synthetic billing demo — document questions" required maxLength={160}/></label>
  <label htmlFor={`outreach-body-${caseId}`}>{kind==="call"?"Discussion plan":"Email text"}</label><textarea id={`outreach-body-${caseId}`} name="body" defaultValue={`This is a synthetic billing demo, not a real patient case.\n\n${plan}`} required maxLength={4000} rows={6}/>
  <button disabled={busy}>Save outreach draft</button>
 </form>
 {error&&<p role="alert">{error}</p>}
 {actions.map(action=><div className="outreach-draft" key={action.id} data-action-id={action.id}>
  <h4>{action.kind==="call"?"AI call":"Email"}: {action.subject}</h4><p>To: {action.destination}</p><p className="outreach-body">{action.body}</p>
  <p>Status: {action.state}{action.provider_status?` · ${action.provider_status}`:""}{action.duration_seconds!=null?` · ${action.duration_seconds} seconds`:""}</p>
  {action.approved_at&&<small>Authorized {new Date(action.approved_at).toLocaleString()}</small>}
  {["unknown","dispatching"].includes(action.state)&&<p>Do not send again. Check the provider before taking another action; the outcome may be uncertain.</p>}
  {action.error_code&&<p>Provider result: {action.error_code}</p>}
  <div className="actions">{action.state==="draft"&&<button disabled={busy||!enabled} onClick={()=>void act(action,true)}>{action.kind==="call"?"Review and authorize call":"Review and authorize email"}</button>}
  {action.provider_id&&<button className="text-button" disabled={busy} onClick={()=>void act(action,false)}>Check provider status</button>}</div>
 </div>)}
 <small>A sent email or completed call is not evidence of a reduced bill or refund.</small></section>;
}
