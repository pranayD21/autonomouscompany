import {useState,type FormEvent} from "react";
import type {BillCase} from "../backend/schema";
import type {CaseInput,ClaimIntake} from "../backend/claim-input";
export function CaseForm({initial,disabled,onSave}:{initial?:BillCase;disabled?:boolean;onSave:(data:CaseInput)=>Promise<void>}) {
 const [kind,setKind]=useState<CaseInput["case_type"]>(initial?.case_type??"workplace_injury");
 const i=initial?.intake??{};
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
  const text=(key:string)=>String(f.get(key)??"").trim();
  const amount=(key:string)=>text(key)===""?null:Math.round(Number(text(key))*100);
  const fields=["contact_name","contact_email","contact_phone","injury_description","incident_date","jurisdiction","employer_name","employer_contact","insurer_name","member_id","claim_number","claim_stage","desired_outcome"] as const;
  const intake=Object.fromEntries(fields.map(key=>[key,text(key)])) as ClaimIntake;
  await onSave({title:text("title"),case_type:kind,intake,bill_cents:amount("bill"),eob_cents:amount("eob"),notes:text("notes")});
  if(!initial)form.reset();
 }
 return <form onSubmit={e=>void submit(e).catch(()=>{})}>
  <label htmlFor={`case-type-${initial?.id??"new"}`}>Case type</label><select id={`case-type-${initial?.id??"new"}`} name="case_type" value={kind} onChange={e=>setKind(e.target.value as CaseInput["case_type"])}><option value="workplace_injury">Workplace injury</option><option value="health_insurance">Health-insurance dispute</option></select>
  <label>Case title<input name="title" defaultValue={initial?.title} required maxLength={120} placeholder="Chemical burn at work"/></label>
  <label>Contact name<input name="contact_name" defaultValue={i.contact_name} required={kind==="workplace_injury"} maxLength={120}/></label>
  <div className="amounts"><label>Contact email<input name="contact_email" type="email" defaultValue={i.contact_email}/></label><label>Contact phone<input name="contact_phone" type="tel" defaultValue={i.contact_phone} pattern="\+[1-9][0-9]{7,14}" placeholder="+15551234567" title="Country code and number, e.g. +15551234567"/></label></div>
  <label htmlFor={`injury-${initial?.id??"new"}`}>What happened?</label><textarea id={`injury-${initial?.id??"new"}`} name="injury_description" defaultValue={i.injury_description} required={kind==="workplace_injury"} maxLength={4000} rows={4} placeholder="What happened? Made-up details only."/>
  <details open={!!initial}><summary>Employer, insurer, and claim details</summary>
   <label>Incident date<input name="incident_date" type="date" defaultValue={i.incident_date}/></label>
   <label>State or jurisdiction<input name="jurisdiction" defaultValue={i.jurisdiction} maxLength={100}/></label>
   <label>Employer name<input name="employer_name" defaultValue={i.employer_name} maxLength={160}/></label>
   <label>Employer claims contact<input name="employer_contact" defaultValue={i.employer_contact} maxLength={254}/></label>
   <label>Insurance company<input name="insurer_name" defaultValue={i.insurer_name} maxLength={160}/></label>
   <label>Member or policy ID (synthetic only)<input name="member_id" defaultValue={i.member_id} maxLength={100}/></label>
   <label>Claim number<input name="claim_number" defaultValue={i.claim_number} maxLength={100}/></label>
   <label htmlFor={`claim-stage-${initial?.id??"new"}`}>Claim stage</label><select id={`claim-stage-${initial?.id??"new"}`} name="claim_stage" defaultValue={i.claim_stage??"unknown"}><option value="unknown">Not sure yet</option><option value="not_started">Not started</option><option value="submitted">Submitted</option><option value="pending">Awaiting response</option><option value="denied">Denied</option><option value="accepted">Accepted</option></select>
   <label htmlFor={`outcome-${initial?.id??"new"}`}>What help do you need?</label><textarea id={`outcome-${initial?.id??"new"}`} name="desired_outcome" defaultValue={i.desired_outcome} maxLength={1000} rows={2}/>
  </details>
  <details open={kind==="health_insurance"}><summary>Bill and EOB amounts</summary><p className="caveat">Leave blank if you don’t know. Enter 0 only if the document shows $0.</p>
   <div className="amounts"><label>Bill amount ($)<input name="bill" type="number" defaultValue={initial?.bill_cents==null?"":initial.bill_cents/100} min="0" max="1000000" step="0.01"/></label><label>EOB responsibility ($)<input name="eob" type="number" defaultValue={initial?.eob_cents==null?"":initial.eob_cents/100} min="0" max="1000000" step="0.01"/></label></div>
  </details>
  <label htmlFor={`notes-${initial?.id??"new"}`}>Case notes</label><textarea id={`notes-${initial?.id??"new"}`} name="notes" defaultValue={initial?.notes} maxLength={8000} rows={3}/>
  <button disabled={disabled}>{initial?"Save updated details":"Save case"}</button>
 </form>;
}
