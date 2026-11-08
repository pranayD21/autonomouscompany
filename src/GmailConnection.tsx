import {useCallback,useEffect,useState} from 'react';
import {api} from './services';
type Connection={available:boolean;state:string;connect_link:string|null;expires_at?:string|null};
export function GmailConnection({caseId,userId}:{caseId:string;userId:string}){
 const [status,setStatus]=useState<Connection|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path=`/cases/${caseId}/gmail`;
 const refresh=useCallback(async()=>{const value=await api<Connection>(path,{},userId);setStatus(value);return value;},[path,userId]);
 useEffect(()=>{void refresh().catch(()=>{});const focus=()=>{void refresh().catch(()=>{});};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[refresh]);
 async function change(method:'POST'|'DELETE'){setBusy(true);setError('');try{setStatus(await api<Connection>(path,{method,...(method==='POST'?{body:JSON.stringify({connect:true})}:{})},userId));}catch(e){setError(e instanceof Error?e.message:'Could not update Gmail connection.');}finally{setBusy(false);}}
 if(!status||!status.available&&['not_configured','advocate_pending'].includes(status.state))return null;
 return <div className="field"><h3>Find documents in Gmail</h3><p>Let your advocate find relevant bills and insurer letters in your Gmail. Access is read-only; you can disconnect it here.</p>
 {status.state==='active'?<><p role="status">Gmail connected for this case.</p><button type="button" disabled={busy} onClick={()=>void change('DELETE')}>Disconnect Gmail</button></>:status.connect_link?<><a className="button" href={status.connect_link} target="_blank" rel="noopener noreferrer">Continue to Gmail authorization</a><button type="button" disabled={busy} onClick={()=>void refresh().catch(()=>setError('Could not check Gmail status.'))}>Check connection</button></>:<button type="button" disabled={busy||!status.available||status.state==='pending_reconciliation'} onClick={()=>void change('POST')}>{busy?'Preparing connection…':status.state==='pending_reconciliation'?'Connection request pending':'Connect Gmail'}</button>}
 {['initiated','failed','pending_reconciliation'].includes(status.state)&&<button type="button" disabled={busy} onClick={()=>void change('DELETE')}>Cancel Gmail connection</button>}
 {error&&<p role="alert">{error}</p>}</div>;
}
