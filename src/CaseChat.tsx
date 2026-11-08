import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {api} from './services';
import {ClaimComposer} from './ui/ClaimComposer';
import {CaseDocumentFeedback, CaseDocumentUpload} from './Documents';
import {Logo} from './Icons';
export type CaseMessage={id:string;role:'user'|'assistant';text:string;created_at:string;kind?:string};
export type CaseConversation={messages:CaseMessage[];state?:string;waiting_on?:string|null;can_send?:boolean};
const statusText=(state?:string)=>state==='human_required'?'Waiting for your reply':state==='running'?'Working on your case':state==='queued'||state==='starting'?'Getting started':state==='stopped'||state==='revoked'?'Paused':state==='completed'?'Work finished':'Your case conversation';
function timestamp(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
/** The case conversation. The case page supplies the header pieces, a banner above the composer, and an overlay (children). */
export function CaseChat({caseId,userId,revision,title,headerStart,headerEnd,beforeCompose,pausedNote=true,children}:{caseId:string;userId:string;revision:number;title?:string;headerStart?:ReactNode;headerEnd?:ReactNode;beforeCompose?:ReactNode;pausedNote?:boolean;children?:ReactNode}){
 const [conversation,setConversation]=useState<CaseConversation>({messages:[]}),[loaded,setLoaded]=useState(false),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef<{id:string;text:string}|null>(null),list=useRef<HTMLDivElement>(null),follow=useRef(true),alive=useRef(true);
 const path=`/cases/${caseId}/messages`;
 const refresh=useCallback(async()=>{const data=await api<CaseConversation>(path,{},userId);if(alive.current){setConversation(data);setLoaded(true);if(pending.current&&data.messages.some(m=>m.id===pending.current!.id)){pending.current=null;setDraft('');setError('');setNotice('Message saved.');}}return data;},[path,userId]);
 useEffect(()=>{alive.current=true;const read=()=>void refresh().catch(e=>{if(alive.current)setError(e instanceof Error?e.message:'Could not load your conversation.');});read();const timer=setInterval(read,5000);const changed=(event:Event)=>{if((event as CustomEvent).detail===caseId)read();};window.addEventListener('assurance:case-changed',changed);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('assurance:case-changed',changed);};},[refresh,caseId]);
 useEffect(()=>{void refresh().catch(()=>{});},[revision,refresh]);
 useEffect(()=>{if(follow.current&&list.current)list.current.scrollTop=list.current.scrollHeight;},[conversation.messages]);
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!draft.trim()||conversation.can_send===false)return;
  const request=pending.current??{id:crypto.randomUUID(),text:draft.trim()};pending.current=request;setBusy(true);setError('');setNotice('');follow.current=true;
  try{await api(path,{method:'POST',body:JSON.stringify(request)},userId);pending.current=null;setDraft('');setNotice('Message saved.');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Could not confirm that your message was saved. Retry to check the same message.');await refresh().catch(()=>{});}
  finally{if(alive.current)setBusy(false);}
 }
 function attach(){document.querySelector<HTMLInputElement>('#section-conversation input[type="file"]')?.click();}
 const stopped=['stopped','revoked'].includes(conversation.state??'');
 const working=['running','queued','starting'].includes(conversation.state??'');
 return <div className="case-chat" data-state={conversation.state}>
  <header className="case-chat-header">
   {headerStart}
   <div className="case-chat-heading"><strong title={title}>{title??'Your Assurance advocate'}</strong><p><span className="chat-state-dot" data-working={working} aria-hidden="true"/>{statusText(conversation.state)}</p></div>
   {headerEnd??<button type="button" className="chat-round" aria-label="Refresh messages" title="Refresh messages" onClick={()=>{setError('');void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not refresh conversation.'));}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg></button>}
  </header>
  <div ref={list} className="case-chat-log" role="log" aria-label="Messages with Assurance" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=list.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
   {!loaded&&<p className="case-chat-empty">Loading conversation…</p>}
   {loaded&&!conversation.messages.length&&<div className="chat-welcome">
    <span className="welcome-mark" aria-hidden="true"><Logo size={20}/></span>
    <p className="chat-welcome-title">Let’s take it from here.</p>
    <p className="chat-welcome-text">Tell us anything new, ask a question, or tap Add documents to share a letter or bill.</p>
   </div>}
   {conversation.messages.map(message=><article key={message.id} className={`case-chat-message case-chat-message--${message.role}`} aria-label={`${message.role==='user'?'You':'Assurance'} message`}><div className="case-chat-bubble"><span className="case-chat-author">{message.role==='user'?'You':'Assurance'}</span><p>{message.text}</p>{message.kind?.startsWith('document_request')&&<button type="button" className="chat-bubble-action" onClick={attach}>Add the document</button>}</div><time dateTime={message.created_at}>{timestamp(message.created_at)}</time></article>)}
  </div>
  {stopped&&pausedNote&&<p className="case-chat-note">Assurance is paused on this case. Your messages are still saved, but they won’t restart the work.</p>}
  {beforeCompose}
  <div className="case-chat-compose">
   <ClaimComposer value={draft} onChange={value=>{setDraft(value);setNotice('');}} onSubmit={send} busy={busy} disabled={!loaded||conversation.can_send===false} readOnly={pending.current!==null} needsAnswer={conversation.state==='human_required'} sendLabel={pending.current?'Retry message':'Send message'} attachment={<CaseDocumentUpload/>}/>
   <CaseDocumentFeedback/>
   {notice&&<p className="case-chat-feedback" role="status">{notice}</p>}
   {error&&<p className="case-chat-feedback" role="alert">{error}</p>}
  </div>
  {children}
 </div>;
}
