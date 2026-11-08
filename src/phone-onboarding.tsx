import {useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,Phone} from './Icons';
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
/** Two or three words for the status pill; the full sentence stays in the live region and the details. */
export function callLabel(status:string){
 switch(status){
  case 'requesting':case 'dispatching':return 'Arranging call';
  case 'submitted':case 'requested':return 'Call requested';
  case 'unknown':case 'unconfirmed':return 'Call unconfirmed';
  case 'cancelled':return 'Onboarding stopped';
  case 'failed':return 'Call incomplete';
  case 'needs_information':return 'Call needed';
  case 'ready':case 'activating':return 'Opening case';
  case 'active':return 'Case ready';
  default:return 'Onboarding';
 }
}
function writePreference(storageKey:string,value:boolean){try{localStorage.setItem(storageKey,String(value));}catch{}}
/**
 * A small status pill (dot + two words) pinned to the top right of the content. Tapping it opens a
 * popover with the call-back number, the case link, the transcript and "I don't need this", which
 * stops onboarding and, when a case exists, deletes it after an inline confirmation.
 */
export function OnboardingCallNotice({userId}:{userId:string}){
 const [notice,setNotice]=useState(read),[status,setStatus]=useState<OnboardingStatus|null>(null),[error,setError]=useState('');
 const [open,setOpen]=useState(false),[confirming,setConfirming]=useState(false),[working,setWorking]=useState(false),[gone,setGone]=useState<string|null>(null);
 const stopPending=useRef(false),version=useRef(0);
 const rootRef=useRef<HTMLElement>(null),pillRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLDivElement>(null),confirmRef=useRef<HTMLButtonElement>(null),dismissRef=useRef<HTMLButtonElement>(null);
 const confirmingRef=useRef(false);confirmingRef.current=confirming;
 const panelId=useId(),titleId=useId();
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
 function close(returnFocus=true){setOpen(false);setConfirming(false);if(returnFocus)pillRef.current?.focus();}
 useEffect(()=>{
  if(!open)return;
  panelRef.current?.focus({preventScroll:true});
  // Escape backs out one step: first the delete confirmation, then the popover.
  const onKey=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;event.preventDefault();if(confirmingRef.current){setConfirming(false);requestAnimationFrame(()=>dismissRef.current?.focus());}else close();};
  const onPointer=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))close(false);};
  document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPointer);
  return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPointer);};
 },[open]);
 useEffect(()=>{if(confirming)confirmRef.current?.focus();},[confirming]);
 const local=notice?.ownerId===userId?notice:null;
 const server=status&&status.status!=='not_started'?status.status:null;
 // "not_started" has nothing to report; a local note only matters until the server knows about the call.
 const message=server?callStatus(server):local&&local.state!=='requested'?local.message:null;
 const noticeKey=`${userId}:${server??local?.state??'unavailable'}`;
 const [dismissed,setDismissed]=useNoticePreference(`assurance-onboarding-dismissed:${noticeKey}`);
 const settled=!!server&&['active','cancelled','failed'].includes(server);
 const caseId=status?.case_id??null;
 const canStop=server?server!=='cancelled':!!local;
 /** Stops onboarding (unless already stopped), then deletes the case it opened, if any. */
 async function dismiss(){
  if(stopPending.current)return;
  stopPending.current=true;version.current++;setWorking(true);setError('');
  let stopped=server==='cancelled'?status:null;
  try{
   if(!stopped){
    stopped=await api<OnboardingStatus>('/phone/onboarding/stop',{method:'POST',body:JSON.stringify({})},userId);
    setStatus(stopped);save({ownerId:userId,state:'requested',message:callStatus(stopped.status)});
   }
   if(caseId)await api<{txid:string}>(`/cases/${caseId}`,{method:'DELETE'},userId);
   const after=stopped?.status??'cancelled';
   writePreference(`assurance-onboarding-dismissed:${userId}:${after}`,true);
   setGone(after);setOpen(false);setConfirming(false);
   const main=document.getElementById('workspace-content');
   if(main){main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}
  }catch(failure){
   const detail=failure instanceof Error?failure.message:'Try again.';
   setError(stopped&&caseId?`Onboarding stopped, but we couldn’t delete the case. ${detail}`:`We couldn’t confirm that onboarding stopped. ${detail}`);
   setConfirming(false);
   requestAnimationFrame(()=>dismissRef.current?.focus());
  }finally{version.current++;stopPending.current=false;setWorking(false);}
 }
 if(gone&&(server??'cancelled')===gone&&!working)return null;
 if(!error&&(!message||(settled&&dismissed)))return null;
 const urgent=!!error||server==='needs_information'||server==='failed'||server==='unknown'||local?.state==='unconfirmed'&&!server;
 const live=!settled&&!error&&server!=='unknown';
 const tone=urgent?'attention':server==='cancelled'?'quiet':'progress';
 const label=error&&!open?'Status unavailable':callLabel(server??local?.state??'');
 const callback=status?.callback_number;
 const canDismiss=canStop||!!caseId;
 const instruction=server==='needs_information'?'Call from your verified phone and say “workplace injury” or “health insurance” to continue.':server==='active'?'Call from your verified phone if you need help with your case.':server==='cancelled'?'You can call from your verified phone to start again.':'Call from your verified phone if you need help.';
 const consequence=caseId?'Stops the call follow-up and deletes this case. This can’t be undone.':'Stops the call follow-up. Nothing else changes.';
 return <aside ref={rootRef} className="onboarding-call-notice" data-open={open} data-tone={tone} aria-label="Onboarding call">
  <span className="visually-hidden" role={urgent?'alert':'status'}>{error||message}</span>
  <button ref={pillRef} type="button" className="onboarding-pill" aria-expanded={open} aria-controls={panelId} onClick={()=>open?close():setOpen(true)}>
   <span className="onboarding-pill-dot" data-live={live} aria-hidden="true"/>
   <span className="onboarding-pill-label">{label}</span>
   <svg className="onboarding-pill-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  <div ref={panelRef} id={panelId} className="onboarding-panel" role="region" aria-labelledby={titleId} tabIndex={-1} hidden={!open}>
   <p id={titleId} className="onboarding-panel-title">{error||message}</p>
   {callback&&<p className="onboarding-panel-note">{instruction}</p>}
   <div className="onboarding-panel-list">
    {callback&&<a className="onboarding-row" href={`tel:${callback}`}><Phone size={16} aria-hidden="true"/><span>Call {formatPhone(callback)}</span></a>}
    {caseId&&<a className="onboarding-row" href={`#case/${caseId}`} onClick={()=>close(false)}><ArrowUpRight size={16} aria-hidden="true"/><span>Open your case</span></a>}
    {!!status?.transcript?.length&&<details className="onboarding-transcript"><summary className="onboarding-row">Call transcript</summary><div className="onboarding-transcript-body">{status.transcript.map((line,index)=><p key={index}><strong>{line.role==='user'?'You':'Assurance'}</strong> {line.text}</p>)}</div></details>}
   </div>
   {(canDismiss||settled)&&<div className="onboarding-panel-foot">
    {confirming?<div className="onboarding-confirm" role="group" aria-label={caseId?'Confirm deleting this case':'Confirm stopping onboarding'}>
     <p>{consequence}</p>
     <div className="onboarding-confirm-actions">
      <button type="button" className="onboarding-confirm-yes" disabled={working} onClick={()=>void dismiss()}>{working?(caseId?'Deleting…':'Stopping…'):(caseId?'Delete case':'Stop follow-up')}</button>
      <button ref={confirmRef} type="button" className="onboarding-confirm-no" disabled={working} onClick={()=>{setConfirming(false);requestAnimationFrame(()=>dismissRef.current?.focus());}}>Cancel</button>
     </div>
    </div>:<>
     {canDismiss&&<button ref={dismissRef} type="button" className="onboarding-dismiss" onClick={()=>setConfirming(true)}>I don’t need this</button>}
     {settled&&<button type="button" className="onboarding-hide" onClick={()=>{setDismissed(true);close(false);}}>Hide</button>}
    </>}
   </div>}
  </div>
 </aside>;
}
