import {Outcomes} from "./Outcomes";
import {useEffect,useState} from "react";
import {Outreach} from "./Outreach";
import {Autonomy} from "./Autonomy";
import {api} from "./services";
import {CaseSection} from "./ui/CaseSection";
import {StatefulButton,StepLoader,TextGenerate} from "./ui/motion";
import {Sparkle} from "./Icons";
type Result={repair_requested_at?:string|null;repair_sent_at?:string|null;research?:{status:string;gaps:string[];sources:{id:string;url:string;title:string;scope:string;retrieved_at:string;sha256:string}[]};saved_at?:string;status:string;stop_reason?:string;approval_required?:boolean;result?:{reply_references?:{reply_id:string;sha256:string}[];research_findings?:{statement:string;source_id:string;quote:string;applicability:string}[];summary:string;document_references?:{document_id:string;sha256:string}[];potential_discrepancy_cents:number|null;next_questions?:string[];coverage_avenues?:{name:string;reason:string;missing_evidence:string[]}[];evidence:string[];missing_information:string[];next_actions:string[];human_help_required:boolean;human_help_reason:string}};
const WORKING=["start_pending","queued","running","rescheduling"];
const STEPS=["Reading your case and documents","Checking official guidance","Comparing what was billed with what is owed","Drafting questions and next steps"];
export function CrewReview({id,userId,enabled,revision}:{id:string;userId:string;enabled:boolean;revision:number}) {
 const [run,setRun]=useState<Result>();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function refresh(){setRun(await api<Result>(`/cases/${id}/crew`,{},userId));}
 useEffect(()=>{void refresh().catch(()=>{});},[id,userId]);
 const working=!!run&&WORKING.includes(run.status)&&!run.result;
 useEffect(()=>{if(!working)return;const timer=setInterval(()=>void refresh().catch(()=>{}),10000);return()=>clearInterval(timer);},[working,id,userId]);
 async function repair(){setBusy(true);setError("");try{await api(`/cases/${id}/crew/repair`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Correction unavailable");}finally{setBusy(false);}}
 async function act(start:boolean){setBusy(true);setError("");try{if(start)await api(`/cases/${id}/crew`,{method:"POST"},userId);await refresh();return true;}catch(e){setError(e instanceof Error?e.message:"Crew unavailable");return false;}finally{setBusy(false);}}
 return <>
 <CaseSection id="section-review" number="03" title="Agent team review" description="A team of agents reads your case, checks official guidance, and drafts the questions worth asking." aside={<div className="actions"><StatefulButton disabled={busy||!enabled||!!run?.saved_at} onAction={()=>act(true)}><Sparkle size={16} aria-hidden="true"/>Run agent team</StatefulButton><button className="text-button" disabled={busy} onClick={()=>void act(false)}>Refresh team status</button></div>}>
 {!enabled&&<p className="muted-empty">The agent team is available to configured test operators.</p>}
 {run&&run.status!=="not_started"&&<p className="run-status" data-working={working}>Status: {run.status}{run.stop_reason?` · ${run.stop_reason}`:""}{run.approval_required?" · Human approval required":""}</p>}
 {working&&<StepLoader steps={STEPS} interval={2600}/>}
  {run?.research&&<section><h4>Official guidance consulted</h4><p>Research status: {run.research.status.replaceAll("_"," ")}. These sources describe general processes, not a coverage decision.</p><ul>{run.research.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · retrieved {new Date(s.retrieved_at).toLocaleDateString()}<p>{s.scope}</p></li>)}</ul>{run.research.gaps.length>0&&<ul>{run.research.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>}</section>}
  {run?.result&&<><TextGenerate className="review-summary" text={run.result.summary}/>{!!run.result.research_findings?.length&&<section><h4>Guidance and applicability</h4>{run.result.research_findings.map((f,i)=>{const source=run.research?.sources.find(s=>s.id===f.source_id);return <div key={i}><p>{f.statement}</p><blockquote>{f.quote}</blockquote><p>{f.applicability}</p>{source&&<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>}</div>;})}</section>}{!!run.result.next_questions?.length&&<><h4>Next questions</h4><ol>{run.result.next_questions.map((q,i)=><li key={i}>{q}</li>)}</ol></>}{!!run.result.coverage_avenues?.length&&<><h4>Coverage to investigate</h4><ul>{run.result.coverage_avenues.map((a,i)=><li key={i}><strong>{a.name}</strong>: {a.reason}<ul>{a.missing_evidence.map((m,j)=><li key={j}>{m}</li>)}</ul></li>)}</ul><small>These are research avenues, not confirmed coverage or benefits.</small></>}<div className="review-columns"><div><h4>Missing information</h4><ul>{run.result.missing_information.map((a,i)=><li key={i}>{a}</li>)}</ul></div><div><h4>Next actions</h4><ul>{run.result.next_actions.map((a,i)=><li key={i}>{a}</li>)}</ul></div></div>{run.result.human_help_required&&<p className="callout">Needs your help: {run.result.human_help_reason}</p>}{run.saved_at&&<p>Review saved to your case.</p>}{!!run.result.document_references?.length&&<div><p>Confirmed document sources</p><ul>{run.result.document_references.map((source,i)=><li key={source.document_id}><a href={`#document-${source.document_id}`}>View source document {i+1}</a></li>)}</ul></div>}{!!run.result.reply_references?.length&&<div><p>Correspondence used</p><ul>{run.result.reply_references.map((r,i)=><li key={r.reply_id}><a href={`#reply-${r.reply_id}`}>View reply {i+1}</a></li>)}</ul></div>}<small>This review does not confirm savings or contact a provider.</small></>}
 {run?.status==="idle"&&run.stop_reason==="end_turn"&&!run.result&&<p role="alert">The review ended without a valid case result. No findings have been saved.{run.repair_sent_at?" The correction attempt has been used; operator review is needed.":" A correction can use the same session and budget."}</p>}
 {enabled&&run?.status==="idle"&&run.stop_reason==="end_turn"&&!run.result&&!run.repair_sent_at&&<button disabled={busy} onClick={()=>void repair()}>Correct rejected review</button>}
 {error&&<p role="alert">{error}</p>}
 </CaseSection>
 <CaseSection id="section-outreach" number="04" title="Outreach & correspondence"><Outreach revision={revision} caseId={id} userId={userId} enabled={enabled} canDraft={!!(run?.saved_at&&run.result)} plan={run?.result?`${run.result.summary}\n\n${(run.result.next_questions??run.result.next_actions).join("\n")}`:""}/></CaseSection>
 <CaseSection id="section-outcomes" number="05" title="Reported outcomes"><Outcomes caseId={id} userId={userId} revision={revision}/></CaseSection>
 <CaseSection id="section-authorization" number="06" title="Agent next steps & authorization"><Autonomy caseId={id} userId={userId} enabled={enabled&&!!(run?.saved_at&&run.result)}/></CaseSection>
 </>;
}
