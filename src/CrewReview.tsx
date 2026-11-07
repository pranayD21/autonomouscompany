import {useEffect,useState} from "react";
import {Outreach} from "./Outreach";
import {api} from "./services";
type Result={saved_at?:string;status:string;stop_reason?:string;approval_required?:boolean;result?:{summary:string;potential_discrepancy_cents:number;evidence:string[];missing_information:string[];next_actions:string[];human_help_required:boolean;human_help_reason:string}};
export function CrewReview({id,userId,enabled}:{id:string;userId:string;enabled:boolean}) {
 const [run,setRun]=useState<Result>();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function refresh(){setRun(await api<Result>(`/cases/${id}/crew`,{},userId));}
 useEffect(()=>{void refresh().catch(()=>{});},[id,userId]);
 async function act(start:boolean){setBusy(true);setError("");try{if(start)await api(`/cases/${id}/crew`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Crew unavailable");}finally{setBusy(false);}}
 return <section className="analysis"><h4>Agent team review</h4>
 {!enabled&&<p>The crew is available to configured test operators.</p>}
 {run&&run.status!=="not_started"&&<p>Status: {run.status}{run.stop_reason?` · ${run.stop_reason}`:""}{run.approval_required?" · Human approval required":""}</p>}
 {run?.result&&<><p>{run.result.summary}</p><h4>Missing information</h4><ul>{run.result.missing_information.map((a,i)=><li key={i}>{a}</li>)}</ul><h4>Next actions</h4><ul>{run.result.next_actions.map((a,i)=><li key={i}>{a}</li>)}</ul>{run.result.human_help_required&&<p>Needs your help: {run.result.human_help_reason}</p>}{run.saved_at&&<p>Review saved to your case.</p>}<small>This review does not confirm savings or contact a provider.</small></>}
 {run?.saved_at&&run.result&&<Outreach caseId={id} userId={userId} enabled={enabled} plan={`${run.result.summary}\n\n${run.result.next_actions.join("\n")}`}/>}
 {error&&<p role="alert">{error}</p>}
 <div className="actions"><button disabled={busy||!enabled||!!run?.saved_at} onClick={()=>void act(true)}>Run agent team</button><button className="text-button" disabled={busy} onClick={()=>void act(false)}>Refresh team status</button></div>
 </section>;
}
