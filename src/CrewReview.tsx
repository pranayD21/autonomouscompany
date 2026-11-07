import {useEffect,useState} from "react";
import {Outreach} from "./Outreach";
import {api} from "./services";
type Result={saved_at?:string;status:string;stop_reason?:string;approval_required?:boolean;result?:{summary:string;document_references?:{document_id:string;sha256:string}[];potential_discrepancy_cents:number|null;next_questions?:string[];coverage_avenues?:{name:string;reason:string;missing_evidence:string[]}[];evidence:string[];missing_information:string[];next_actions:string[];human_help_required:boolean;human_help_reason:string}};
export function CrewReview({id,userId,enabled,revision}:{id:string;userId:string;enabled:boolean;revision:number}) {
 const [run,setRun]=useState<Result>();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function refresh(){setRun(await api<Result>(`/cases/${id}/crew`,{},userId));}
 useEffect(()=>{void refresh().catch(()=>{});},[id,userId]);
 async function act(start:boolean){setBusy(true);setError("");try{if(start)await api(`/cases/${id}/crew`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Crew unavailable");}finally{setBusy(false);}}
 return <section className="analysis"><h4>Agent team review</h4>
 {!enabled&&<p>The crew is available to configured test operators.</p>}
 {run&&run.status!=="not_started"&&<p>Status: {run.status}{run.stop_reason?` · ${run.stop_reason}`:""}{run.approval_required?" · Human approval required":""}</p>}
 {run?.result&&<><p>{run.result.summary}</p>{!!run.result.next_questions?.length&&<><h4>Next questions</h4><ol>{run.result.next_questions.map((q,i)=><li key={i}>{q}</li>)}</ol></>}{!!run.result.coverage_avenues?.length&&<><h4>Coverage to investigate</h4><ul>{run.result.coverage_avenues.map((a,i)=><li key={i}><strong>{a.name}</strong>: {a.reason}<ul>{a.missing_evidence.map((m,j)=><li key={j}>{m}</li>)}</ul></li>)}</ul><small>These are research avenues, not confirmed coverage or benefits.</small></>}<h4>Missing information</h4><ul>{run.result.missing_information.map((a,i)=><li key={i}>{a}</li>)}</ul><h4>Next actions</h4><ul>{run.result.next_actions.map((a,i)=><li key={i}>{a}</li>)}</ul>{run.result.human_help_required&&<p>Needs your help: {run.result.human_help_reason}</p>}{run.saved_at&&<p>Review saved to your case.</p>}{!!run.result.document_references?.length&&<div><p>Confirmed document sources</p><ul>{run.result.document_references.map((source,i)=><li key={source.document_id}><a href={`#document-${source.document_id}`}>View source document {i+1}</a></li>)}</ul></div>}<small>This review does not confirm savings or contact a provider.</small></>}
 {run?.saved_at&&run.result&&<Outreach revision={revision} caseId={id} userId={userId} enabled={enabled} plan={`${run.result.summary}\n\n${(run.result.next_questions??run.result.next_actions).join("\n")}`}/>}
 {run?.status==="idle"&&run.stop_reason==="end_turn"&&!run.result&&<p role="alert">The review ended without a valid case result. No findings have been saved.</p>}
 {error&&<p role="alert">{error}</p>}
 <div className="actions"><button disabled={busy||!enabled||!!run?.saved_at} onClick={()=>void act(true)}>Run agent team</button><button className="text-button" disabled={busy} onClick={()=>void act(false)}>Refresh team status</button></div>
 </section>;
}
