import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from './services';
import {ClaimComposer} from './ui/ClaimComposer';
import {CaseDocumentFeedback, CaseDocumentUpload} from './Documents';
export type CaseMessage={id:string;role:'user'|'assistant';text:string;created_at:string;kind?:string};
export type CaseConversation={messages:CaseMessage[];state?:string;waiting_on?:string|null;can_send?:boolean};
const statusText=(state?:string)=>state==='human_required'?'Waiting for your reply':state==='running'?'Working on your case':state==='queued'||state==='starting'?'Getting started':state==='stopped'||state==='revoked'?'Agent work is stopped':state==='completed'?'Work finished':'Your case conversation';
function timestamp(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
export function CaseChat({caseId,userId,revision}:{caseId:string;userId:string;revision:number}){
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
 return <div className="case-chat" data-state={conversation.state}>
  <header className="case-chat-header"><span className="claim-orb" data-working={['running','queued','starting'].includes(conversation.state??'')} aria-hidden="true"><span/></span><div><strong>Your Assurance advocate</strong><p><span className="chat-state-dot" aria-hidden="true"/>{statusText(conversation.state)}</p></div><button type="button" className="text-button chat-refresh" aria-label="Refresh messages" title="Refresh messages" onClick={()=>{setError('');void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not refresh conversation.'));}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg></button></header>
  <div ref={list} className="case-chat-log" role="log" aria-label="Messages with Assurance" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=list.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
   {!loaded&&<p className="case-chat-empty">Loading conversation…</p>}
   {loaded&&!conversation.messages.length&&<div className="chat-welcome"><span className="welcome-mark" aria-hidden="true">✦</span><span className="eyebrow">A little less on your shoulders</span><h2>Let’s take it from here.</h2><p>Share an update, ask a question, or add a claim letter. Your conversation with Assurance stays here.</p><div className="chat-starters"><button type="button" disabled={busy||pending.current!==null||conversation.can_send===false} onClick={()=>{setDraft('What happens next with my claim?');document.querySelector<HTMLTextAreaElement>('#section-conversation textarea')?.focus();}}>What happens next? <span aria-hidden="true">↗</span></button><button type="button" onClick={attach}>Add a claim letter <span aria-hidden="true">+</span></button></div></div>}
   {conversation.messages.map(message=><article key={message.id} className={`case-chat-message case-chat-message--${message.role}`} aria-label={`${message.role==='user'?'You':'Assurance'} message`}><div className="case-chat-bubble"><span className="case-chat-author">{message.role==='user'?'You':'Assurance'}</span><p>{message.text}</p>{message.kind?.startsWith('document_request')&&<button type="button" className="text-button" onClick={attach}>Add requested document</button>}</div><time dateTime={message.created_at}>{timestamp(message.created_at)}</time></article>)}
  </div>
  {stopped&&<p className="case-chat-note">You can keep adding information. Sending a message will not restart stopped agent work.</p>}
  <div className="case-chat-compose"><ClaimComposer value={draft} onChange={value=>{setDraft(value);setNotice('');}} onSubmit={send} busy={busy} disabled={!loaded||conversation.can_send===false} readOnly={pending.current!==null} needsAnswer={conversation.state==='human_required'} sendLabel={pending.current?'Retry message':'Send message'} attachment={<CaseDocumentUpload/>}/><CaseDocumentFeedback/></div>
  {notice&&<p className="case-chat-feedback" role="status">{notice}</p>}
  {error&&<p className="case-chat-feedback" role="alert">{error}</p>}
 </div>;
}
