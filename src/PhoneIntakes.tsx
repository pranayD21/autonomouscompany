import {PhoneSignIn,usePhoneStatus} from './PhoneSignIn';
import {phoneSelected} from './phone-session';
import {useEffect,useState} from 'react';import {api} from './services';
type Intake={id:string;case_type:string;narrative:string;case_id:string|null};
export function PhoneIntakes({userId}:{userId:string}){
 const status=usePhoneStatus();
 const [notices,setNotices]=useState<{id:string;case_id:string;kind:string;state:string}[]>([]);
 const [items,setItems]=useState<Intake[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(phoneSelected()){api<Intake[]>('/phone/intakes',{},userId).then(setItems).catch(e=>setError(e.message));api<typeof notices>('/phone/notifications',{},userId).then(setNotices).catch(()=>{});}},[userId]);
 async function claim(item:Intake){setBusy(true);setError('');try{const r=await api<{case_id:string}>(`/phone/intakes/${item.id}/claim`,{method:'POST',body:JSON.stringify({confirm:true,start_agent:true})},userId);window.location.replace(`/#case/${r.case_id}`);}catch(e){setError(e instanceof Error?e.message:'Unable to save intake.');}finally{setBusy(false);}}
 if(!phoneSelected())return status?.enabled?<details className="fold"><summary>Link a phone to your account</summary><PhoneSignIn linkExisting status={status}/></details>:null;
 if(!items.some(i=>!i.case_id)&&!notices.length&&!error)return null;
 return <section className="auth-card phone-intake-card" aria-label="Phone intake"><h2>Your phone intake</h2><p>Here is what you told Assurance on your call.</p>{items.filter(i=>!i.case_id).map(item=><article key={item.id}><h3>{item.case_type==='workplace_injury'?'Workplace injury':'Health insurance claim'}</h3><p>{item.narrative}</p><p>Continue to have Assurance research, contact relevant organizations, and follow up for you. You can stop it anytime.</p><button disabled={busy} onClick={()=>void claim(item)}>Continue with my case</button></article>)}{notices.filter(n=>n.kind==='document_problem'||n.kind==='document_request').slice(0,5).map(n=><p key={n.id} role={n.kind==='document_problem'?'status':undefined}>{n.kind==='document_problem'?'A document needs attention.':'A document has been requested.'} <a href={`#case/${n.case_id}`}>Open the case to review it</a></p>)}{!items.length&&<p>No pending call intake. You can open a case in your dashboard.</p>}{error&&<p role="alert">{error}</p>}<button className="text-button" onClick={()=>void api('/phone/preferences',{method:'POST',body:JSON.stringify({sms_consent:false})},userId).then(()=>setError('Case texts stopped.')).catch(e=>setError(e.message))}>Stop case texts</button></section>;
}
