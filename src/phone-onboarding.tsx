import {useEffect,useId,useRef,useState} from 'react';
import {api} from './services';
import {phoneSession} from './phone-session';
import {formatPhone} from './format';

type OnboardingStatus={enabled?:boolean;phone?:string;status:string;case_id?:string|null;reason?:string|null;callback_number?:string|null;transcript?:Array<{role:'user'|'agent';text:string;time?:string}>};
type CallNotice={ownerId:string;state:'requesting'|'requested'|'unconfirmed';message:string};
const key='assurance-onboarding-call';
function read():CallNotice|null{try{return JSON.parse(sessionStorage.getItem(key)??'null');}catch{return null;}}
function save(value:CallNotice){sessionStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event('assurance-onboarding-call'));}
function readPreference(storageKey:string){try{return localStorage.getItem(storageKey)==='true';}catch{return false;}}
function useNoticePreference(storageKey:string){
 const [preference,setPreference]=useState(()=>({key:storageKey,value:readPreference(storageKey)}));
 useEffect(()=>setPreference({key:storageKey,value:readPreference(storageKey)}),[storageKey]);
 const value=preference.key===storageKey&&preference.value;
 function setValue(next:boolean){
  setPreference({key:storageKey,value:next});
  try{localStorage.setItem(storageKey,String(next));}catch{}
 }
 return [value,setValue] as const;
}

/** Invoked by the explicit verification action, never by mounting the dashboard. */
export async function requestOnboardingCall(){
 const session=await phoneSession();
 if(!session?.user)throw Error('Your phone session could not be loaded. Reload to try again.');
 const ownerId=session.user.id;
 save({ownerId,state:'requesting',message:'Requesting your onboarding call…'});
 try{
  const result=await api<OnboardingStatus>('/phone/onboarding',{method:'POST',body:JSON.stringify({request_call:true,accept_standard_handling:true})},ownerId);
  save({ownerId,state:['failed','unknown'].includes(result.status)?'unconfirmed':'requested',message:callStatus(result.status)});
  return result;
 }catch(error){
  save({ownerId,state:'unconfirmed',message:`You’re signed in. We couldn’t confirm your onboarding call. ${error instanceof Error?error.message:'You can start your case below.'}`});
  return null;
 }
}
export function callStatus(status:string){
 switch(status){
  case 'dispatching':return 'Your onboarding call is being arranged.';
  case 'submitted':return 'Your onboarding call has been requested. Keep your phone nearby.';
  case 'unknown':return 'The call’s status is unconfirmed. We won’t automatically request another call.';
  case 'cancelled':return 'Onboarding and case work are stopped. An already requested call may still connect.';
  case 'failed':return 'The onboarding call could not be completed. You can start your case below.';
  case 'needs_information':return 'Your call needs a little more information before a case can be opened.';
  case 'ready':case 'activating':return 'Your call is complete. Your case is getting started.';
  case 'active':return 'Your case is ready. Open it to follow progress and add documents.';
  default:return 'Your phone account is ready. You can start a case below.';
 }
}
export function OnboardingCallNotice({userId}:{userId:string}){
 const [notice,setNotice]=useState(read),[status,setStatus]=useState<OnboardingStatus|null>(null),[error,setError]=useState(''),[stopping,setStopping]=useState(false);
 const stopPending=useRef(false),version=useRef(0);
 useEffect(()=>{
  let active=true;
  const refreshNotice=()=>setNotice(read());
  const refresh=()=>{
   if(stopPending.current)return Promise.resolve();
   const current=version.current;
   return api<OnboardingStatus>('/phone/onboarding',{},userId).then(result=>{if(active&&version.current===current){setStatus(result);setError('');}}).catch(()=>{if(active&&version.current===current)setError('Call status could not be refreshed. Reload to check again.');});
  };
  void refresh();const timer=setInterval(()=>void refresh(),10000);
  window.addEventListener('assurance-onboarding-call',refreshNotice);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('assurance-onboarding-call',refreshNotice);};
 },[userId]);
 async function stop(){
  if(stopPending.current)return;
  stopPending.current=true;version.current++;setStopping(true);setError('');
  try{
   const result=await api<OnboardingStatus>('/phone/onboarding/stop',{method:'POST',body:JSON.stringify({})},userId);
   setStatus(result);save({ownerId:userId,state:'requested',message:callStatus(result.status)});
  }catch(error){setError(`We couldn’t confirm that onboarding stopped. ${error instanceof Error?error.message:'Try stopping again.'}`);}
  finally{version.current++;stopPending.current=false;setStopping(false);}
 }
 const local=notice?.ownerId===userId?notice:null;
 const server=status&&status.status!=='not_started'?status.status:null;
 // "not_started" has nothing to report; a local note only matters until the server knows about the call.
 const message=server?callStatus(server):local&&local.state!=='requested'?local.message:null;
 const noticeKey=`${userId}:${server??local?.state??'unavailable'}`;
 const [dismissed,setDismissed]=useNoticePreference(`assurance-onboarding-dismissed:${noticeKey}`);
 const [expanded,setExpanded]=useNoticePreference(`assurance-onboarding-expanded:${noticeKey}`);
 const detailsId=useId();
 const settled=!!server&&['active','cancelled','failed'].includes(server);
 if(!error&&(!message||(settled&&dismissed)))return null;
 const canStop=server?server!=='cancelled':!!local;
 const urgent=!!error||server==='needs_information'||server==='failed'||server==='unknown';
 const callback=status?.callback_number;
 const hasDetails=canStop||!!callback||!!status?.case_id||!!status?.transcript?.length;
 return <aside className="onboarding-call-notice" data-expanded={expanded} data-urgent={urgent} aria-label="Onboarding call">
  <div className="onboarding-bar">
   <span className="onboarding-bar-dot" aria-hidden="true"/>
   <p role={error||urgent?'alert':'status'}>{error||(server==='needs_information'?'We need a little more information to open your case.':message)}</p>
   {hasDetails&&<button type="button" className="onboarding-toggle" aria-expanded={expanded} aria-controls={detailsId} aria-label={expanded?'Hide call details':'Show call details'} onClick={()=>setExpanded(!expanded)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>}
   {settled&&message&&!error&&<button type="button" className="onboarding-dismiss" aria-label="Dismiss onboarding notice" onClick={()=>setDismissed(true)}>×</button>}
  </div>
  {hasDetails&&<div id={detailsId} className="onboarding-details" hidden={!expanded}>
   {callback&&<p className="onboarding-callback">{server==='needs_information'?'Call from your verified phone. Say “workplace injury” or “health insurance” to continue.':server==='active'?'Call from your verified phone if you need help with your case.':server==='cancelled'?'You can call from your verified phone to start again.':'Call from your verified phone if you need help.'}</p>}
   <div className="onboarding-actions">
    {callback&&<a className="text-link onboarding-open" href={`tel:${callback}`}>Call {formatPhone(callback)}</a>}
    {status?.case_id&&<a className="text-link onboarding-open" href={`#case/${status.case_id}`}>Open your case</a>}
    {canStop&&<button type="button" className="text-button onboarding-stop" disabled={stopping} onClick={()=>void stop()}>{stopping?'Stopping onboarding…':'Stop onboarding and case work'}</button>}
   </div>
   {!!status?.transcript?.length&&<details><summary>Call transcript</summary>{status.transcript.map((line,index)=><p key={index}><strong>{line.role==='user'?'You':'Assurance'}:</strong> {line.text}</p>)}</details>}
  </div>}
 </aside>;
}
