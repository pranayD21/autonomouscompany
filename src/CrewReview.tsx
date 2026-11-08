import {Outcomes} from "./Outcomes";
import {useEffect,useState} from "react";
import {Outreach} from "./Outreach";
import {Autonomy} from "./Autonomy";
import {api} from "./services";
import {CaseSection} from "./ui/CaseSection";
import {StatefulButton,StepLoader} from "./ui/motion";
import {Sparkle} from "./Icons";
import type {StepId,StepState} from "./progress";
type Result={repair_requested_at?:string|null;repair_sent_at?:string|null;research?:{status:string;gaps:string[];sources:{id:string;url:string;title:string;scope:string;retrieved_at:string;sha256:string}[]};saved_at?:string;status:string;stop_reason?:string;approval_required?:boolean;result?:{reply_references?:{reply_id:string;sha256:string}[];research_findings?:{statement:string;source_id:string;quote:string;applicability:string}[];summary:string;document_references?:{document_id:string;sha256:string}[];potential_discrepancy_cents:number|null;next_questions?:string[];coverage_avenues?:{name:string;reason:string;missing_evidence:string[]}[];evidence:string[];missing_information:string[];next_actions:string[];human_help_required:boolean;human_help_reason:string}};
const WORKING=["start_pending","queued","running","rescheduling"];
const STEPS=["Reading your case and documents","Checking official guidance","Comparing what was billed with what is owed","Drafting questions and next steps"];
export function CrewReview({id,userId,enabled,revision,quickAnalysis,steps}:{id:string;userId:string;enabled:boolean;revision:number;quickAnalysis?:string|null;steps?:Record<StepId,StepState>}) {
 const [run,setRun]=useState<Result>();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function refresh(){setRun(await api<Result>(`/cases/${id}/crew`,{},userId));}
 useEffect(()=>{void refresh().catch(()=>{});},[id,userId]);
 const working=!!run&&WORKING.includes(run.status)&&!run.result;
 useEffect(()=>{if(!working)return;const timer=setInterval(()=>void refresh().catch(()=>{}),10000);return()=>clearInterval(timer);},[working,id,userId]);
 async function repair(){setBusy(true);setError("");try{await api(`/cases/${id}/crew/repair`,{method:"POST"},userId);await refresh();}catch(e){setError(e instanceof Error?e.message:"Correction unavailable");}finally{setBusy(false);}}
 async function act(start:boolean){setBusy(true);setError("");try{if(start)await api(`/cases/${id}/crew`,{method:"POST"},userId);await refresh();return true;}catch(e){setError(e instanceof Error?e.message:"Crew unavailable");return false;}finally{setBusy(false);}}
 const failed=run?.status==="idle"&&run.stop_reason==="end_turn"&&!run.result;
 const r=run?.result;
 const hasDetails=!!(run?.research||r?.research_findings?.length||r?.coverage_avenues?.length||r?.document_references?.length||r?.reply_references?.length);
 return <>
 <CaseSection id="section-authorization" title="Agent work" status={steps?.agent}><Autonomy caseId={id} userId={userId} enabled={enabled}/></CaseSection>
 <details className="fold"><summary>Additional review and communication tools</summary>
 <CaseSection id="section-review" title="Optional Naïve review" aside={<div className="actions"><StatefulButton className="secondary" disabled={busy||!enabled||!!run?.saved_at} onAction={()=>act(true)}><Sparkle size={16} aria-hidden="true"/>Run agent team</StatefulButton>{working&&<button className="text-button" disabled={busy} onClick={()=>void act(false)}>Refresh team status</button>}</div>}>
 {!enabled&&<p className="quiet-line">This optional Naïve review is available to test operators. Use Agent work above to start ongoing work on your case.</p>}
 {quickAnalysis&&<div className="analysis"><h4>Questions for the insurer</h4><p>{quickAnalysis}</p></div>}
 {run&&(working||(!r&&run.status!=="not_started"&&run.status!=="idle"&&run.status!=="completed"))&&<p className="run-status" data-working={working}>Status: {run.status.replaceAll("_"," ")}{run.approval_required?" · needs your approval":""}</p>}
 {working&&<StepLoader steps={STEPS} interval={2600}/>}
 {!r&&!working&&!quickAnalysis&&enabled&&!failed&&<p className="quiet-line">No review yet.</p>}
 {r&&<>
  <p className="review-summary">{r.summary}</p>
  {r.human_help_required&&<p className="callout">Needs your help: {r.human_help_reason}</p>}
  <div className="review-columns">
   <div><h4>Next actions</h4><ul>{r.next_actions.map((a,i)=><li key={i}>{a}</li>)}</ul></div>
   <div><h4>Missing information</h4><ul>{r.missing_information.map((a,i)=><li key={i}>{a}</li>)}</ul></div>
  </div>
  {!!r.next_questions?.length&&<><h4>Questions to ask</h4><ol>{r.next_questions.map((q,i)=><li key={i}>{q}</li>)}</ol></>}
  <p className="caveat">AI-drafted from your documents. Not legal advice or verified savings.</p>
 </>}
 {hasDetails&&<details className="fold"><summary>How we got here</summary>
  {run?.research&&<section><h4>Official guidance consulted</h4><p>These sources describe general processes, not a coverage decision.</p><ul>{run.research.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · retrieved {new Date(s.retrieved_at).toLocaleDateString()}<p>{s.scope}</p></li>)}</ul>{run.research.gaps.length>0&&<ul>{run.research.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>}</section>}
  {!!r?.research_findings?.length&&<section><h4>Guidance and applicability</h4>{r.research_findings.map((f,i)=>{const source=run?.research?.sources.find(s=>s.id===f.source_id);return <div key={i}><p>{f.statement}</p><blockquote>{f.quote}</blockquote><p>{f.applicability}</p>{source&&<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>}</div>;})}</section>}
  {!!r?.coverage_avenues?.length&&<><h4>Coverage to investigate</h4><ul>{r.coverage_avenues.map((a,i)=><li key={i}><strong>{a.name}</strong>: {a.reason}<ul>{a.missing_evidence.map((m,j)=><li key={j}>{m}</li>)}</ul></li>)}</ul></>}
  {!!r?.document_references?.length&&<><h4>Documents used</h4><ul>{r.document_references.map((source,i)=><li key={source.document_id}><a href={`#document-${source.document_id}`}>View source document {i+1}</a></li>)}</ul></>}
  {!!r?.reply_references?.length&&<><h4>Replies used</h4><ul>{r.reply_references.map((x,i)=><li key={x.reply_id}><a href={`#reply-${x.reply_id}`}>View reply {i+1}</a></li>)}</ul></>}
 </details>}
 {failed&&<p role="alert">The review ended without a valid result. Nothing was saved.{run?.repair_sent_at?" The correction attempt has been used; operator review is needed.":""}</p>}
 {enabled&&failed&&!run?.repair_sent_at&&<button disabled={busy} onClick={()=>void repair()}>Correct rejected review</button>}
 {error&&<p role="alert">{error}</p>}
 </CaseSection>
 <CaseSection id="section-outreach" title="Outreach">
  <Outreach revision={revision} caseId={id} userId={userId} enabled={enabled} canDraft={!!(run?.saved_at&&run.result)} plan={run?.result?`${run.result.summary}\n\n${(run.result.next_questions??run.result.next_actions).join("\n")}`:""}/>
 </CaseSection>
 </details>
 <CaseSection id="section-outcomes" title="Outcomes" status={steps?.outcome}><Outcomes caseId={id} userId={userId} revision={revision}/></CaseSection>
 </>;
}
