export type AgentSession = {
 id:string;authority_id:string;state:string;engine?:string;next_check_at:string|null;reason:string|null;created_at:string;
 goal?:string|null;finish_condition?:string|null;waiting_on?:string|null;last_activity_at?:string|null;
};
export function engineLabel(engine?:string){
 if(engine==='direct_openai'||engine==='direct')return 'Direct model';
 if(engine==='naive'||engine===undefined)return 'Naïve';
 return 'Agent engine';
}
export function sessionStatus(session:Pick<AgentSession,'state'>){
 switch(session.state){
  case 'starting':case 'queued':return {label:'Queued',detail:'The agent has not started this turn yet.'};
  case 'running':return {label:'Working',detail:'The agent is processing this case.'};
  case 'idle':case 'waiting':return {label:'Waiting',detail:'The agent is waiting for new information or its next follow-up.'};
  case 'human_required':case 'needs_input':return {label:'Needs your attention',detail:'Assurance needs an answer from you before it can continue.'};
  case 'failed':case 'error':return {label:'Work interrupted',detail:'The agent could not continue. No successful outcome is implied.'};
  case 'completed':return {label:'Agent finished',detail:'Review the documented outcome and supporting evidence.'};
  case 'stopped':case 'cancelled':return {label:'Stopped',detail:'This agent session is no longer advancing the case.'};
  default:return {label:'Status unavailable',detail:'We could not identify the agent state. Refresh before relying on this status.'};
 }
}
export function activationRequest(consent:string){
 const value=consent.trim();if(!value)throw Error('Describe what you authorize Assurance to do.');
 return {authorize:true,persistent:true,policy:{version:2,consent:value}};
}
export function sessionNeedsProviderApproval(session:Pick<AgentSession,'state'|'engine'>){
 return session.state==='human_required'&&(session.engine===undefined||session.engine==='naive');
}
