import {useEffect,useRef,useState,type FormEvent} from "react";
import {api,auth} from "./services";
import type {DocumentExtraction} from "../backend/providers/document-reader";
import type {CaseDocument} from "../backend/schema";
type DocumentView=Omit<CaseDocument,"object_key"> & {extraction_state:string|null;extraction_result:DocumentExtraction|null;extraction_error:string|null;confirmed_at:string|null};
export function Documents({caseId,userId,revision,enabled}:{caseId:string;userId:string;revision:number;enabled:boolean}){
 const [docs,setDocs]=useState<DocumentView[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const uploadId=useRef(crypto.randomUUID());
 const path=`/cases/${caseId}/documents`;
 async function refresh(){setDocs(await api(path,{},userId));}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[caseId,userId,revision]);
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");const form=event.currentTarget;
  try{const data=new FormData(form);data.set("id",uploadId.current);await api(path,{method:"POST",body:data},userId);uploadId.current=crypto.randomUUID();form.reset();await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Upload failed. Retry the same file.");}finally{setBusy(false);}
 }
 async function download(doc:Omit<CaseDocument,"object_key">){
  setError("");try{
   const session=await auth.getSession();if(session.data?.user.id!==userId)throw new Error("Please sign in again.");
   const response=await fetch(`${import.meta.env.VITE_CASES_API_URL}${path}/${doc.id}/download`,{headers:{Authorization:`Bearer ${session.data.session.token}`}});
   if(!response.ok)throw new Error("Document download failed.");
   const url=URL.createObjectURL(await response.blob());const a=document.createElement("a");a.href=url;a.download=doc.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError((e as Error).message);}
 }
 async function extract(id:string,action:"start"|"refresh"|"confirm"){
  setBusy(true);setError("");try{await api(`${path}/${id}/extraction${action==="start"?"":`/${action}`}`,{method:"POST",...(action==="confirm"?{body:JSON.stringify({confirm:true})}:{})},userId);await refresh();}catch(e){setError((e as Error).message);await refresh().catch(()=>{});}finally{setBusy(false);}
 }
 return <section className="analysis"><h4>Case documents</h4><p>Add a synthetic insurance card, bill, EOB, or incident record. Files are private to your account. Read images or PDF text with the intake agent, then check the transcription before adding it to claim evidence. Scanned PDFs need page images.</p>
 <form onSubmit={upload}>
 <label>Document type<select name="kind" onChange={()=>{uploadId.current=crypto.randomUUID();}}><option value="insurance_card">Insurance card</option><option value="bill">Medical bill</option><option value="eob">Explanation of benefits</option><option value="incident">Incident record</option><option value="other">Other evidence</option></select></label>
 <label>Document file<input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required disabled={busy} onChange={()=>{uploadId.current=crypto.randomUUID();}}/></label>
 <small>PNG, JPEG, WebP, or PDF, up to 5 MB. Documents are retained; deletion is not available in this prototype.</small>
 <button disabled={busy}>{busy?"Uploading…":"Save document"}</button></form>
 {error&&<p role="alert">{error}</p>}
 <ul>{docs.map(doc=><li key={doc.id} id={`document-${doc.id}`}>{doc.filename} · {doc.kind.replaceAll("_"," ")} · {doc.state==="ready"?"Saved":"Upload incomplete — retry the same file"}{doc.state==="ready"&&<button className="text-button" onClick={()=>void download(doc)}>Download {doc.filename}</button>}
 {doc.state==="ready"&&<div>
 <p>Reading: {doc.extraction_state??"not started"}{doc.extraction_error?` · ${doc.extraction_error}`:""}</p>
 {!doc.extraction_state||doc.extraction_state==="source_ready"?<button disabled={busy||!enabled} onClick={()=>void extract(doc.id,"start")}>Read {doc.filename}</button>:null}
 {["running","preparing"].includes(doc.extraction_state??"")&&<button disabled={busy} onClick={()=>void extract(doc.id,"refresh")}>Refresh reading</button>}
 {doc.extraction_result&&<details open={!doc.confirmed_at}><summary>Document transcription{doc.confirmed_at?" · confirmed":" · needs your review"}</summary><p style={{whiteSpace:"pre-wrap"}}>{doc.extraction_result.visible_text}</p>
 <dl>{(["insurer_name","member_name","member_id","group_number","claim_number"] as const).map(key=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{doc.extraction_result![key]??"Not found"}</dd></div>)}</dl>
 {doc.extraction_result.uncertainties.length>0&&<ul>{doc.extraction_result.uncertainties.map((u,i)=><li key={i}>{u}</li>)}</ul>}
 {!doc.confirmed_at&&<><p>Compare this text with the original. Confirm only if accurate. If it is wrong, leave it unconfirmed and upload a clearer image or add corrected details to your case. Confirmation does not establish coverage.</p><button disabled={busy} onClick={()=>void extract(doc.id,"confirm")}>Confirm transcription</button></>}
 </details>}
 </div>}</li>)}</ul>
 </section>;
}
