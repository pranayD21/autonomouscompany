import {useEffect,useRef,useState,type FormEvent} from "react";
import {api,auth} from "./services";
import type {CaseDocument} from "../backend/schema";
export function Documents({caseId,userId,revision}:{caseId:string;userId:string;revision:number}){
 const [docs,setDocs]=useState<Omit<CaseDocument,"object_key">[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
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
 return <section className="analysis"><h4>Case documents</h4><p>Add a synthetic insurance card, bill, EOB, or incident record. Files are private to your account. Uploading saves the original; automatic reading is not yet available.</p>
 <form onSubmit={upload}>
 <label>Document type<select name="kind" onChange={()=>{uploadId.current=crypto.randomUUID();}}><option value="insurance_card">Insurance card</option><option value="bill">Medical bill</option><option value="eob">Explanation of benefits</option><option value="incident">Incident record</option><option value="other">Other evidence</option></select></label>
 <label>Document file<input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required disabled={busy} onChange={()=>{uploadId.current=crypto.randomUUID();}}/></label>
 <small>PNG, JPEG, WebP, or PDF, up to 5 MB. Documents are retained; deletion is not available in this prototype.</small>
 <button disabled={busy}>{busy?"Uploading…":"Save document"}</button></form>
 {error&&<p role="alert">{error}</p>}
 <ul>{docs.map(doc=><li key={doc.id}>{doc.filename} · {doc.kind.replaceAll("_"," ")} · {doc.state==="ready"?"Saved":"Upload incomplete — retry the same file"}{doc.state==="ready"&&<button className="text-button" onClick={()=>void download(doc)}>Download {doc.filename}</button>}</li>)}</ul>
 </section>;
}
