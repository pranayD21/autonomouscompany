import {useEffect,useRef,useState,type FormEvent} from "react";
import {api,auth} from "./services";
import type {DocumentExtraction} from "../backend/providers/document-reader";
import type {CaseDocument} from "../backend/schema";
import {FileDrop} from "./ui/FileDrop";
import {AnimatePresence,motion} from "motion/react";
const KIND:Record<string,string>={insurance_card:"Insurance card",bill:"Medical bill",eob:"EOB",incident:"Incident record",other:"Other evidence"};
type DocumentView=Omit<CaseDocument,"object_key"> & {extraction_state:string|null;extraction_result:DocumentExtraction|null;extraction_error:string|null;confirmed_at:string|null};
export function Documents({caseId,userId,revision}:{caseId:string;userId:string;revision:number}){
 const [docs,setDocs]=useState<DocumentView[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[uploads,setUploads]=useState(0);
 const uploadId=useRef(crypto.randomUUID());
 const path=`/cases/${caseId}/documents`;
 async function refresh(){setDocs(await api(path,{},userId));}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[caseId,userId,revision]);
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");const form=event.currentTarget;
  try{const data=new FormData(form);data.set("id",uploadId.current);await api(path,{method:"POST",body:data},userId);const savedId=uploadId.current;uploadId.current=crypto.randomUUID();form.reset();setUploads(n=>n+1);await api(`${path}/${savedId}/extraction`,{method:"POST"},userId);await refresh();}
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
 return <div className="documents">
 <form className="upload-form" onSubmit={upload}>
 <FileDrop name="file" label="Document file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} resetKey={String(uploads)} onPick={()=>{uploadId.current=crypto.randomUUID();}}/>
 <div className="upload-side">
 <label>Document type<select name="kind" onChange={()=>{uploadId.current=crypto.randomUUID();}}><option value="insurance_card">Insurance card</option><option value="bill">Medical bill</option><option value="eob">Explanation of benefits</option><option value="incident">Incident record</option><option value="other">Other evidence</option></select></label>
 <small>PNG, JPEG, WebP or PDF · up to 5 MB · private to you</small>
 <button disabled={busy}>{busy?"Uploading…":"Upload document"}</button>
 </div></form>
 {error&&<p role="alert">{error}</p>}
 {docs.length===0&&<p className="quiet-line">No documents yet.</p>}
 <ul className="doc-list"><AnimatePresence initial={false}>{docs.map(doc=><motion.li layout key={doc.id} id={`document-${doc.id}`} className="doc-card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
 <div className="doc-head"><span className="doc-icon" aria-hidden="true">{doc.kind.slice(0,1).toUpperCase()}</span><div><strong>{doc.filename}</strong><span>{KIND[doc.kind]??doc.kind.replaceAll("_"," ")}{doc.state==="ready"?"":" · Upload incomplete — retry the same file"}</span></div>
 {doc.state==="ready"&&<button className="text-button" onClick={()=>void download(doc)}>Download {doc.filename}</button>}</div>
 {doc.state==="ready"&&<div className="doc-body">
 <p className="doc-reading" data-state={doc.confirmed_at?"confirmed":doc.extraction_state??"none"}>{doc.confirmed_at?"Confirmed":doc.extraction_result?"Read from document":["running","preparing","direct_running"].includes(doc.extraction_state??"")?"Reading…":doc.extraction_error?`Couldn’t read: ${doc.extraction_error}`:"Not read yet"}</p>
 {!doc.extraction_state||["source_ready","direct_failed","direct_running"].includes(doc.extraction_state)?<button disabled={busy} onClick={()=>void extract(doc.id,"start")}>Read {doc.filename}</button>:null}
 {["running","preparing","direct_running"].includes(doc.extraction_state??"")&&<button disabled={busy} onClick={()=>void extract(doc.id,"refresh")}>Refresh reading</button>}
 {doc.extraction_result&&<details><summary>Document transcription{doc.confirmed_at?" · confirmed":" · machine extracted"}</summary><p style={{whiteSpace:"pre-wrap"}}>{doc.extraction_result.visible_text}</p>
 <dl>{(["insurer_name","member_name","member_id","group_number","claim_number"] as const).map(key=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{doc.extraction_result![key]??"Not found"}</dd></div>)}</dl>
 {doc.extraction_result.uncertainties.length>0&&<ul>{doc.extraction_result.uncertainties.map((u,i)=><li key={i}>{u}</li>)}</ul>}
 {!doc.confirmed_at&&<><p className="caveat">Optional: confirm that this transcription matches the original.</p><button disabled={busy} onClick={()=>void extract(doc.id,"confirm")}>Confirm transcription matches</button></>}
 </details>}
 </div>}</motion.li>)}</AnimatePresence></ul>
 </div>;
}
