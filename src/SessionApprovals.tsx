import {useState} from "react";
import {api} from "./services";
type Pending={hash:string;name:string;args:Record<string,unknown>;supported:boolean};
type Review={status:string;stop_reason:string|null;actions:Pending[];history:{id:string;tool_name:string;decision:string;state:string}[]};
export function SessionApprovals({caseId,runId,userId}:{caseId:string;runId:string;userId:string}){
 const [review,setReview]=useState<Review>(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const path=`/cases/${caseId}/sessions/${runId}/approvals`;
 async function refresh(){setBusy(true);setError("");try{setReview(await api<Review>(path,{},userId));}catch(e){setError(e instanceof Error?e.message:"Pending actions unavailable");}finally{setBusy(false);}}
 async function confirm(action:Pending,decision:"allow"|"deny"){
  setBusy(true);setError("");try{
   const result=await api<{state:string}>(path,{method:"POST",body:JSON.stringify({confirm:true,hash:action.hash,decision})},userId);
   if(result.state==="uncertain")setError("Confirmation status is uncertain. No automatic retry was made. Refresh to inspect the existing session.");
   else setReview(undefined);
  }catch(e){setError(e instanceof Error?e.message:"Confirmation failed");}finally{setBusy(false);}
 }
 return <section aria-label="Pending agent actions"><button disabled={busy} onClick={()=>void refresh()}>Review pending actions</button>
 {error&&<p role="alert">{error}</p>}
 {review&&<><p>Provider status: {review.status.replaceAll("_"," ")}{review.stop_reason?` · ${review.stop_reason.replaceAll("_"," ")}`:""}</p>
 {!review.actions.length&&<p>No tool confirmation is pending. Other pauses may still require operator help.</p>}
 {review.actions.map(action=><div key={action.hash}><h5>{action.name}</h5><pre className="outreach-body">{JSON.stringify(action.args,null,2)}</pre>
 {action.supported?<><p>Approve this one action within the existing case authorization. This does not add contacts, increase limits, or grant future approvals.</p><button disabled={busy} onClick={()=>void confirm(action,"allow")}>Approve this action</button><button disabled={busy} onClick={()=>void confirm(action,"deny")}>Deny this action</button></>:<p>This action requires review in Naïve; Assurance cannot confirm it here.</p>}</div>)}
 {review.history.map(item=><p key={item.id}>{item.tool_name}: {item.decision} · {item.state}</p>)}
 </>}
 </section>;
}
