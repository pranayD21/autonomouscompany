import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {cases,caseAuthorities} from './schema';
import {caseInput} from './claim-input';
import {authorizeCase} from './autonomy-service';
import {DEFAULT_INTAKE_CONSENT} from './intake-policy';
import {shortCaseTitle} from './case-title';

export async function submitCase(db:NodePgDatabase,owner:string,raw:unknown,start:boolean,id=randomUUID()){
 const parsed=caseInput.parse(raw);
 const input={...parsed,title:await shortCaseTitle(parsed.title,parsed.intake?.injury_description||parsed.notes)};
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
 const {sendCaseMessage}=await import('./case-messages');
 const {saved,resumed}=await sendCaseMessage(db,caseId,owner,{id:eventId,text});
 return {saved,resumed};
}
