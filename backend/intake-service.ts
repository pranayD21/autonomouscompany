import {randomUUID} from 'node:crypto';
import {and,eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {cases,caseAuthorities,directCaseRuns} from './schema';
import {caseInput} from './claim-input';
import {authorizeCase,resumeCaseAuthority} from './autonomy-service';
import {DEFAULT_INTAKE_CONSENT} from './intake-policy';
import {queueCaseAgentEvent} from './case-agent-events';

export async function submitCase(db:NodePgDatabase,owner:string,raw:unknown,start:boolean,id=randomUUID()){
 const input=caseInput.parse(raw);
 return db.transaction(async tx=>{
  // Serialize a retried client request before checking the case/authority pair.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`);
  const [existing]=await tx.select().from(cases).where(eq(cases.id,id));
  if(existing){
   if(existing.owner_id!==owner)throw Error('NOT_FOUND');
   const [authority]=await tx.select().from(caseAuthorities).where(eq(caseAuthorities.case_id,id));
   return {id,txid:(await tx.execute(sql`SELECT pg_current_xact_id()::text AS txid`)).rows[0].txid as string,agent_started:!!authority};
  }
  const [created]=await tx.insert(cases).values({...input,id,owner_id:owner}).returning({id:cases.id,txid:sql<string>`pg_current_xact_id()::text`});
  if(start)await authorizeCase(tx,id,owner,{version:2,consent:DEFAULT_INTAKE_CONSENT},undefined,true);
  return {...created,agent_started:start};
 });
}

export async function addOwnerUpdate(db:NodePgDatabase,caseId:string,owner:string,text:string,eventId:string){
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.owner_id,owner))).for('update');
  if(!item)throw Error('NOT_FOUND');
  const key=`owner_answer:${eventId}`;
  const latest=await tx.execute(sql`SELECT id FROM advocacy_direct_case_runs WHERE case_id=${caseId} ORDER BY created_at DESC LIMIT 1`);
  if(!latest.rows.length)throw Error('NO_AGENT');
  const prior=await tx.execute(sql`SELECT e.payload FROM advocacy_direct_case_events e JOIN advocacy_direct_case_runs r ON r.id=e.run_id WHERE r.case_id=${caseId} AND e.event_key=${key} LIMIT 1`);
  if(prior.rows.length){if((prior.rows[0].payload as {text:string}).text!==text)throw Error('UPDATE_CONFLICT');return {saved:true,resumed:false};}
  const notes=[item.notes,`Owner update: ${text}`].filter(Boolean).join('\n\n');
  if(notes.length>8000)throw Error('NOTES_FULL');
  await tx.update(cases).set({notes,revision:sql`${cases.revision}+1`,analysis:null,status:'new'}).where(eq(cases.id,caseId));
  await queueCaseAgentEvent(tx,caseId,key,'claimant_updated_case',{text,revision:item.revision+1});
  await tx.execute(sql`INSERT INTO advocacy_direct_case_events(run_id,event_key,kind,payload,processed_at) VALUES(${latest.rows[0].id},${key},'owner_update_recorded',${JSON.stringify({text,revision:item.revision+1})}::jsonb,now()) ON CONFLICT(run_id,event_key) DO NOTHING`);
  const [run]=await tx.select().from(directCaseRuns).where(and(eq(directCaseRuns.case_id,caseId),eq(directCaseRuns.state,'human_required')));
  let resumed=false;
  if(run){
   // A savepoint preserves the answer even when an uncertain dispatch forbids resume.
   try{await tx.transaction(async nested=>{await resumeCaseAuthority(nested,caseId,run.authority_id,owner);});resumed=true;}
   catch(error){if(!(error instanceof Error)||!['RUN_BUSY','UNRESOLVED_DISPATCH','PERMISSION_ENDED','NOT_RESUMABLE'].includes(error.message))throw error;}
  }
  return {saved:true,resumed};
 });
}
