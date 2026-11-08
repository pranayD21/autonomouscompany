import {DEFAULT_INTAKE_CONSENT} from "../backend/intake-policy";
import {SessionApprovals} from "./SessionApprovals";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {api} from "./services";
import {Timeline,TimelineItem} from "./ui/motion";
import {activationRequest,engineLabel,sessionNeedsProviderApproval,sessionStatus,type AgentSession} from "./activation-state";
import type {caseDecisions} from "../backend/schema";
type Authority={id:string;state:string;reason:string|null;next_wake_at:string|null;policy:{version?:number;consent?:string;expires_at?:string;max_decisions?:number;max_outbound?:number};decisions_used:number;outbound_used:number};
type Decision=Pick<typeof caseDecisions.$inferSelect,"id"|"round"|"state"|"decision"|"result"|"created_at">;
type Setup={id:string;authority_id?:string;state:string;reason:string|null};
type History={authorities:Authority[];decisions:Decision[];sessions?:AgentSession[];activation_available?:boolean;persistent_available?:boolean;setups?:Setup[]};
const empty:History={authorities:[],decisions:[],sessions:[],setups:[]};
function dateLabel(value:string|null|undefined){if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toLocaleString();}
export function Autonomy({caseId,userId,enabled}:{caseId:string;userId:string;enabled:boolean}){
 const [data,setData]=useState<History>(empty),[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState("");
 const [answer,setAnswer]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const updateId=useRef(crypto.randomUUID());
 const [savedUpdate,setSavedUpdate]=useState(false);
 const path=`/cases/${caseId}/autonomy`;
 async function refresh(){try{setData(await api<History>(path,{},userId));setLoaded(true);setLoadError("");}catch(e){setLoadError(e instanceof Error?e.message:"Could not refresh case status.");}}
 useEffect(()=>{let live=true;setLoaded(false);setData(empty);setLoadError("");setError("");setAnswer("");setSavedUpdate(false);updateId.current=crypto.randomUUID();
  const read=()=>{api<History>(path,{},userId).then(d=>{if(live){setData(d);setLoaded(true);setLoadError("");}}).catch(()=>{if(live)setLoadError("Could not refresh case status. The last shown status may be out of date.");});};
  read();const timer=setInterval(read,15000);return()=>{live=false;clearInterval(timer)};
 },[caseId,userId]);
 const current=data.authorities.find(a=>["active","waiting","human_required"].includes(a.state));
 const available=data.activation_available??(enabled&&data.persistent_available===true);
 const currentSessions=(data.sessions??[]).filter(s=>s.authority_id===current?.id);
 const pendingSetup=(data.setups??[]).some(s=>s.state==='queued'&&(!s.authority_id||s.authority_id===current?.id));
 async function authorize(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{await api(path,{method:"POST",body:JSON.stringify(activationRequest(DEFAULT_INTAKE_CONSENT))},userId);await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Could not start. Refresh the case status before trying again.");}finally{setBusy(false);}}
 async function answerQuestion(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy||!answer.trim())return;setBusy(true);setError("");try{await api(`/cases/${caseId}/updates`,{method:"POST",body:JSON.stringify({id:updateId.current,text:answer.trim()})},userId);setAnswer("");updateId.current=crypto.randomUUID();setSavedUpdate(true);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not save your response.");}finally{setBusy(false);}}
 async function resume(id:string){setBusy(true);setError("");try{await api(`${path}/${id}/resume`,{method:"POST",body:JSON.stringify({confirm:true})},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not continue the case. Refresh to check its current status.");}finally{setBusy(false);}}
 async function stop(id:string){setBusy(true);setError("");try{await api(`${path}/${id}/revoke`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not stop the case. Refresh to check its current status.");}finally{setBusy(false);}}
 return <section className="autonomy" aria-label="Case agent activation">
  <p className="section-lede">Follow the work here. Assurance will ask when it needs something only you can provide.</p>
  {!loaded&&!loadError&&<p>Loading case status…</p>}
  {loadError&&<div role="alert"><p>{loadError}</p><button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh case status</button></div>}
  {loaded&&!current&&!available&&<p>Agent work is temporarily unavailable. Your case is saved.</p>}
  {loaded&&!current&&available&&<form onSubmit={authorize} aria-label="Start case agent">
   <p>{data.authorities.length?"This case is stopped. Start again only if you want Assurance to continue.":"This saved case has not started yet."}</p>
   <p className="caveat">Starting asks Assurance to research, contact relevant organizations, and follow up on your behalf. You can stop it anytime.</p>
   <button disabled={busy}>{busy?"Starting…":"Start handling my case"}</button>
  </form>}
  {error&&<p role="alert">{error}</p>}
  {savedUpdate&&<p role="status">Update saved.</p>}
  {current&&!currentSessions.length&&<p role="status"><strong>{pendingSetup?'Activation queued':'Activation pending'}</strong> — your agent will begin shortly.</p>}
  {current&&<button className="text-button" disabled={busy} onClick={()=>void stop(current.id)}>Stop agent work</button>}
  <details className="fold"><summary>Scope and controls</summary>
  <p>Stopping prevents new work. A communication already being sent may finish.</p>
  {data.authorities.map(a=><div key={a.id}><p>{a.state.replaceAll("_"," ")}</p>{a.policy.version===2?<p>{a.policy.consent}</p>:<p>Earlier authorization retains its original scope and expiry.</p>}{a.reason&&<p>{a.reason}</p>}</div>)}
  </details>
  {(data.setups??[]).map(setup=><div key={setup.id}><p>Case agent setup: {setup.state.replaceAll('_',' ')}</p>{setup.reason&&<p>{setup.reason}</p>}</div>)}
  {(data.sessions??[]).map(session=>{const status=sessionStatus(session);return <article key={session.id} aria-label="Case agent status">
   <h5>{status.label}</h5><p>{status.detail}</p>
   {session.goal&&<><strong>Agent goal</strong><p>{session.goal}</p></>}
   <details><summary>Agent details</summary><p>Engine: {engineLabel(session.engine)}</p>{session.finish_condition&&<p>Finish condition: {session.finish_condition}</p>}</details>
   {session.waiting_on&&<><strong>Waiting for</strong><p>{session.waiting_on}</p></>}
   {session.reason&&<p>{session.reason}</p>}
   {dateLabel(session.last_activity_at)&&<p>Last activity: {dateLabel(session.last_activity_at)}</p>}
   {dateLabel(session.next_check_at)&&<p>Next check: {dateLabel(session.next_check_at)}</p>}
   {session.state==="human_required"&&session.engine==="direct_openai"&&current?.id===session.authority_id&&<div><form onSubmit={answerQuestion}><label>Your response<textarea value={answer} onChange={e=>setAnswer(e.target.value)} required maxLength={4000} placeholder="Answer here and Assurance will continue."/></label><button disabled={busy||!answer.trim()}>Send response</button></form><button className="text-button" disabled={busy} onClick={()=>void resume(session.authority_id)}>Continue with updated information</button></div>}
   {sessionNeedsProviderApproval(session)&&<SessionApprovals caseId={caseId} runId={session.id} userId={userId}/>}
  </article>})}
  {data.decisions.some(d=>d.decision?.tool==="request_human_help")&&<p>Recorded requests for human help: {data.decisions.filter(d=>d.decision?.tool==="request_human_help").length}</p>}
  {data.decisions.length>0&&<Timeline>{data.decisions.map(d=><TimelineItem key={d.id} label={`Round ${d.round}`}><article><h5>Decision {d.round}: {d.decision?.tool.replaceAll("_"," ")??d.state}</h5>{d.decision&&<p>{d.decision.reason}</p>}{d.decision&&"body" in d.decision&&<><strong>{d.decision.subject}</strong><p className="outreach-body">{d.decision.body}</p></>}{d.decision&&"question" in d.decision&&<p>{d.decision.question}</p>}{d.result&&<p>{String(d.result.reason??"")}</p>}</article></TimelineItem>)}</Timeline>}
 </section>;
}
