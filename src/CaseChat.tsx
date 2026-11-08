import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from './services';
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
 function attach(){const target=document.getElementById('section-documents');target?.scrollIntoView({behavior:'smooth',block:'start'});target?.querySelector<HTMLInputElement>('input[type="file"]')?.focus({preventScroll:true});}
 const stopped=['stopped','revoked'].includes(conversation.state??'');
 return <div className="case-chat">
  <header className="case-chat-header"><span className="case-chat-avatar" aria-hidden="true">A</span><div><strong>Assurance</strong><p>{statusText(conversation.state)}</p></div><button type="button" className="text-button" onClick={()=>{setError('');void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not refresh conversation.'));}}>Refresh messages</button></header>
  <div ref={list} className="case-chat-log" role="log" aria-label="Messages with Assurance" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=list.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
   {!loaded&&<p className="case-chat-empty">Loading conversation…</p>}
   {loaded&&!conversation.messages.length&&<p className="case-chat-empty">Share an update or add a document. Assurance’s questions and case updates will appear here.</p>}
   {conversation.messages.map(message=><article key={message.id} className={`case-chat-message case-chat-message--${message.role}`} aria-label={`${message.role==='user'?'You':'Assurance'} message`}><div className="case-chat-bubble"><span className="case-chat-author">{message.role==='user'?'You':'Assurance'}</span><p>{message.text}</p>{message.kind?.startsWith('document_request')&&<button type="button" className="text-button" onClick={attach}>Add requested document</button>}</div><time dateTime={message.created_at}>{timestamp(message.created_at)}</time></article>)}
  </div>
  {stopped&&<p className="case-chat-note">You can keep adding information. Sending a message will not restart stopped agent work.</p>}
  <form className="case-chat-compose" aria-label="Message Assurance" onSubmit={send}>
   <label htmlFor={`message-${caseId}`} className="visually-hidden">Message Assurance</label>
   <textarea id={`message-${caseId}`} rows={2} maxLength={4000} value={draft} disabled={busy||conversation.can_send===false||pending.current!==null} onChange={e=>{setDraft(e.target.value);setNotice('');}} placeholder="Message Assurance…"/>
   <div className="case-chat-compose-actions"><button type="button" className="text-button" onClick={attach}>Attach document</button><button type="submit" disabled={busy||!draft.trim()||conversation.can_send===false}>{busy?'Sending…':pending.current?'Retry message':'Send message'}</button></div>
  </form>
  {notice&&<p className="case-chat-feedback" role="status">{notice}</p>}
  {error&&<p className="case-chat-feedback" role="alert">{error}</p>}
 </div>;
}
