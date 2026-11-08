import {useEffect,useState,type FormEvent} from "react";
import {api} from "./services";
import type {caseAuthorities,caseDecisions} from "../backend/schema";
type Authority=typeof caseAuthorities.$inferSelect;
type Session={id:string;authority_id:string;state:string;next_check_at:string|null;reason:string|null;created_at:string};
type Decision=Pick<typeof caseDecisions.$inferSelect,"id"|"round"|"state"|"decision"|"result"|"created_at">;
export function Autonomy({caseId,userId,enabled}:{caseId:string;userId:string;enabled:boolean}){
 const [data,setData]=useState<{authorities:Authority[];decisions:Decision[];sessions?:Session[]}>({authorities:[],decisions:[],sessions:[]});
 const [scope,setScope]=useState<"research"|"email">("research");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const path=`/cases/${caseId}/autonomy`;
 async function refresh(){setData(await api(path,{},userId));}
 useEffect(()=>{let live=true;const read=()=>{api<typeof data>(path,{},userId).then(d=>{if(live)setData(d)}).catch(()=>{});};read();const timer=setInterval(read,15000);return()=>{live=false;clearInterval(timer)};},[caseId,userId]);
 const current=data.authorities.find(a=>["active","waiting","human_required"].includes(a.state));
 async function authorize(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError("");
  const customer=String(form.get("customer")??"").trim(),insurer=String(form.get("insurer")??"").trim();
  const contacts=scope==="research"?[]:[{id:"customer",role:"customer",channel:"email",destination:customer},...(insurer?[{id:"insurer",role:"insurer",channel:"email",destination:insurer}]:[])];
  try{await api(path,{method:"POST",body:JSON.stringify({authorize:true,policy:{synthetic:true,goal:String(form.get("goal")),contacts,max_decisions:3,max_outbound:scope==="research"?0:2,min_contact_interval_minutes:60,expires_at:new Date(Date.now()+86400000).toISOString()}})},userId);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Authorization failed");}finally{setBusy(false);}}
 async function stop(id:string){setBusy(true);setError("");try{await api(`${path}/${id}/revoke`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not stop the case");}finally{setBusy(false);}}
 return <section className="analysis"><h4>Let the agent manage next steps</h4><p>Naïve chooses whether to ask a question, follow up, wait, or stop. Choose whether this synthetic test may contact anyone. This does not authorize real claims, payments, or settlements.</p>
 {!current&&enabled&&<form onSubmit={authorize}>
  <label>Case objective<textarea name="goal" required minLength={10} maxLength={1000} defaultValue="Gather missing fictional employer, incident, and claim details; explain what is still needed to proceed."/></label>
  <label>Communication permission<select value={scope} onChange={e=>setScope(e.target.value as "research"|"email")} disabled={busy}><option value="research">Review only — no emails or calls</option><option value="email">Allow synthetic emails</option></select></label>
  {scope==="email"&&<><label>Customer test email<input name="customer" type="email" required maxLength={254}/></label>
  <label>Insurer test email (optional)<input name="insurer" type="email" maxLength={254}/></label></>}
  <p>Limits: {scope==="research"?"no emails or calls":"2 emails total, at least 1 hour between contacts"}, 3 agent decision rounds, expires after 24 hours. Each decision uses the existing agent budget cap.{scope==="email"&&" Only server-approved test contacts are accepted."}</p>
  <label key={scope}><input type="checkbox" required/> {scope==="research"?"I authorize the agent to review this synthetic case within these limits, without contacting anyone.":"These recipients agreed to this synthetic test. I authorize routine emails within these limits without approving each message."}</label>
  <button disabled={busy}>{scope==="research"?"Authorize review only":"Authorize autonomous email test"}</button>
 </form>}
 {error&&<p role="alert">{error}</p>}
 {data.authorities.map(a=><div key={a.id}><p>Status: {a.state.replaceAll("_"," ")} · Decisions {a.decisions_used}/{a.policy.max_decisions} · Contacts {a.outbound_used}/{a.policy.max_outbound}</p><p>{a.reason}</p><small>Authorization expires {new Date(a.policy.expires_at).toLocaleString()}{a.next_wake_at?` · Next check due ${new Date(a.next_wake_at).toLocaleString()}`:""}</small>{["active","waiting","human_required"].includes(a.state)&&<div><button disabled={busy} onClick={()=>void stop(a.id)}>Stop autonomous work</button><p>A dispatch already in progress may finish. No new action starts after the stop is recorded.</p></div>}</div>)}
 {(data.sessions??[]).map(session=><div key={session.id}><h5>Case agent session: {session.state.replaceAll("_"," ")}</h5>{session.reason&&<p>{session.reason}</p>}{session.next_check_at&&<p>Next status check: {new Date(session.next_check_at).toLocaleString()}</p>}<p>A status check does not mean a message or call will be sent.</p></div>)}
 {data.decisions.some(d=>d.decision?.tool==="request_human_help")&&<p>Recorded requests for human help: {data.decisions.filter(d=>d.decision?.tool==="request_human_help").length}</p>}
 {data.decisions.map(d=><article key={d.id}><h5>Decision {d.round}: {d.decision?.tool.replaceAll("_"," ")??d.state}</h5>{d.decision&&<p>{d.decision.reason}</p>}{d.decision&&"body" in d.decision&&<><strong>{d.decision.subject}</strong><p className="outreach-body">{d.decision.body}</p></>}{d.decision&&"question" in d.decision&&<p>{d.decision.question}</p>}{d.result&&<p>{String(d.result.reason??"")}</p>}</article>)}
 </section>;
}
