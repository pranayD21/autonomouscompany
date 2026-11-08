import {useEffect,useState} from "react";
import {api} from "./services";
import type {readCaseOutcomes} from "../backend/case-outcome";
type OutcomesData=Awaited<ReturnType<typeof readCaseOutcomes>>;
const money=(value:number|null)=>value===null?"Not established":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);
export function Outcomes({caseId,userId,revision}:{caseId:string;userId:string;revision:number}){
 const [data,setData]=useState<OutcomesData>([]),[error,setError]=useState("");
 useEffect(()=>{let live=true;setData([]);setError("");const read=()=>api<OutcomesData>(`/cases/${caseId}/outcomes`,{},userId).then(rows=>{if(live){setData(rows);setError("");}}).catch(()=>{if(live)setError("Could not refresh outcomes. Previously loaded results may be out of date.");});void read();const timer=setInterval(()=>void read(),15000);return()=>{live=false;clearInterval(timer);};},[caseId,userId,revision]);
 return <section className="analysis" aria-label="Case outcomes"><h4>Reported outcomes</h4>
 <p>These are the agent’s interpretations of case evidence, not independently verified payouts. New reports preserve earlier results.</p>
 {error&&<p role="alert">{error}</p>}
 {!data.length&&!error&&<p>No outcome has been recorded.</p>}
 {[...data].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).map(row=><div key={row.id} className="outcome-report">
 <h5>{new Date(row.created_at).toLocaleString()} · Agent-reported</h5>
 {!row.evidence_current&&<p role="alert">Supporting evidence is no longer current. Do not rely on these amounts until the evidence is reviewed.</p>}
 <p>{row.report.summary}</p><p>Claim decision: {row.report.claim_decision.replaceAll("_"," ")}</p>
 <dl><dt>Original patient responsibility</dt><dd>{money(row.report.original_responsibility_cents)}</dd><dt>Final patient responsibility</dt><dd>{money(row.report.final_responsibility_cents)}</dd><dt>Reported reduction</dt><dd>{money(row.report.reduction_cents)}</dd><dt>Refund reported as received</dt><dd>{money(row.report.refund_received_cents)}</dd></dl>
 <p>{row.report.calculation_explanation}</p>
 <details><summary>Supporting quotes</summary>{row.report.evidence.map((source,i)=><div key={i}><blockquote>{source.quote}</blockquote><small>{source.source_ref.startsWith("document:")?"Document":"Received reply"} reference: {source.source_ref}</small></div>)}</details>
 </div>)}
 </section>;
}
