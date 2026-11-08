import {SessionApprovals} from "./SessionApprovals";
import {useEffect,useState,type FormEvent} from "react";
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
 const [consent,setConsent]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const path=`/cases/${caseId}/autonomy`;
 async function refresh(){try{setData(await api<History>(path,{},userId));setLoaded(true);setLoadError("");}catch(e){setLoadError(e instanceof Error?e.message:"Could not refresh case status.");}}
 useEffect(()=>{let live=true;setLoaded(false);setData(empty);setLoadError("");setError("");setConsent("");setConfirmed(false);
  const read=()=>{api<History>(path,{},userId).then(d=>{if(live){setData(d);setLoaded(true);setLoadError("");}}).catch(()=>{if(live)setLoadError("Could not refresh case status. The last shown status may be out of date.");});};
  read();const timer=setInterval(read,15000);return()=>{live=false;clearInterval(timer)};
 },[caseId,userId]);
 const current=data.authorities.find(a=>["active","waiting","human_required"].includes(a.state));
 const available=data.activation_available??(enabled&&data.persistent_available===true);
 const currentSessions=(data.sessions??[]).filter(s=>s.authority_id===current?.id);
 const pendingSetup=(data.setups??[]).some(s=>s.state==='queued'&&(!s.authority_id||s.authority_id===current?.id));
 async function authorize(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!confirmed||busy)return;setBusy(true);setError("");
  try{await api(path,{method:"POST",body:JSON.stringify(activationRequest(consent))},userId);setConfirmed(false);setConsent("");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Activation failed. Check the case status before trying again.");}finally{setBusy(false);}}
 async function resume(id:string){setBusy(true);setError("");try{await api(`${path}/${id}/resume`,{method:"POST",body:JSON.stringify({confirm:true})},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not continue the case. Refresh to check its current status.");}finally{setBusy(false);}}
 async function stop(id:string){setBusy(true);setError("");try{await api(`${path}/${id}/revoke`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not stop the case. Refresh to check its current status.");}finally{setBusy(false);}}
 return <section className="autonomy" aria-label="Case agent activation">
  <p className="section-lede">Give permission once. The agent sets a goal, follows up for you, and asks when it needs something.</p>
  {!loaded&&!loadError&&<p>Loading case status…</p>}
  {loadError&&<div role="alert"><p>{loadError}</p><button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh case status</button></div>}
  {loaded&&!current&&<p className="caveat"><strong>Case saved. No active authorization.</strong> Saving details or uploading a document does not start agent work.</p>}
  {loaded&&!current&&!available&&<p>Automatic work is not enabled for this account right now. Your saved case remains available.</p>}
  {loaded&&!current&&available&&<form onSubmit={authorize} aria-label="Start case agent">
   <label htmlFor={`case-permission-${caseId}`}>Your permission</label><textarea id={`case-permission-${caseId}`} name="consent" required value={consent} disabled={busy} placeholder="Describe what you want Assurance to handle and any boundaries it should follow." onChange={e=>{setConsent(e.target.value);setConfirmed(false);}}/>
   <p>The agent can research, contact insurers or claims administrators, follow up, and request documents within the permission you give. You can stop ongoing work from this panel.</p>
   <p className="caveat">This form does not authorize payments or accepting a settlement. Coverage, savings, and claim approval are not guaranteed.</p>
   <label><input type="checkbox" checked={confirmed} disabled={busy} required onChange={e=>setConfirmed(e.target.checked)}/> I authorize ongoing work within the permission above. I can stop it at any time.</label>
   <button disabled={busy||!consent.trim()||!confirmed}>{busy?"Starting case agent…":"Start case agent"}</button>
  </form>}
  {error&&<p role="alert">{error}</p>}
  {current&&!currentSessions.length&&<p role="status"><strong>{pendingSetup?'Activation queued':'Activation pending'}</strong> — permission is saved, but an agent session has not started yet.</p>}
  {data.authorities.map(a=><div key={a.id} className="authority-card" data-state={a.state}>
   <p>Permission: {a.state.replaceAll("_"," ")}</p>
   {a.policy.version===2&&a.policy.consent&&<><strong>Your permission</strong><p className="outreach-body">{a.policy.consent}</p></>}
   {a.policy.version!==2&&<p>Earlier authorization: {a.decisions_used} decisions and {a.outbound_used} contacts recorded.{dateLabel(a.policy.expires_at)?` Its original expiry is ${dateLabel(a.policy.expires_at)}.`:''} Its original scope remains unchanged.</p>}
   {a.reason&&<p>{a.reason}</p>}
   {dateLabel(a.next_wake_at)&&<p>Next follow-up due: {dateLabel(a.next_wake_at)}</p>}
   {["active","waiting","human_required"].includes(a.state)&&<div><button disabled={busy} onClick={()=>void stop(a.id)}>Stop agent work</button><p>A communication already being sent may finish. Stopping prevents new work after the stop is recorded.</p></div>}
  </div>)}
  {(data.setups??[]).map(setup=><div key={setup.id}><p>Case agent setup: {setup.state.replaceAll('_',' ')}</p>{setup.reason&&<p>{setup.reason}</p>}</div>)}
  {(data.sessions??[]).map(session=>{const status=sessionStatus(session);return <article key={session.id} aria-label="Case agent status">
   <h5>{status.label}</h5><p>{status.detail}</p><p>Engine: {engineLabel(session.engine)}</p>
   {session.goal&&<><strong>Agent goal</strong><p>{session.goal}</p></>}
   {session.finish_condition&&<><strong>Finish condition</strong><p>{session.finish_condition}</p></>}
   {session.waiting_on&&<><strong>Waiting for</strong><p>{session.waiting_on}</p></>}
   {session.reason&&<p>{session.reason}</p>}
   {dateLabel(session.last_activity_at)&&<p>Last activity: {dateLabel(session.last_activity_at)}</p>}
   {dateLabel(session.next_check_at)&&<p>Next check: {dateLabel(session.next_check_at)}</p>}
   {session.state==="human_required"&&session.engine==="direct_openai"&&current?.id===session.authority_id&&<div><p>Continue after reviewing the request or adding the missing information. Your original permission stays unchanged.</p><button disabled={busy} onClick={()=>void resume(session.authority_id)}>Continue with updated information</button></div>}
   {sessionNeedsProviderApproval(session)&&<SessionApprovals caseId={caseId} runId={session.id} userId={userId}/>}
  </article>})}
  {data.decisions.some(d=>d.decision?.tool==="request_human_help")&&<p>Recorded requests for human help: {data.decisions.filter(d=>d.decision?.tool==="request_human_help").length}</p>}
  {data.decisions.length>0&&<Timeline>{data.decisions.map(d=><TimelineItem key={d.id} label={`Round ${d.round}`}><article><h5>Decision {d.round}: {d.decision?.tool.replaceAll("_"," ")??d.state}</h5>{d.decision&&<p>{d.decision.reason}</p>}{d.decision&&"body" in d.decision&&<><strong>{d.decision.subject}</strong><p className="outreach-body">{d.decision.body}</p></>}{d.decision&&"question" in d.decision&&<p>{d.decision.question}</p>}{d.result&&<p>{String(d.result.reason??"")}</p>}</article></TimelineItem>)}</Timeline>}
 </section>;
}
