import {and,eq} from 'drizzle-orm';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import type {CaseToolIdentity} from './case-tools';
import {caseAuthorities,caseToolCredentials,cases,firmEvents} from './schema';
import {firmEnabled,queueFirmEvent} from './firm-events';
export async function requestCompanyHelp(db:NodePgDatabase,identity:CaseToolIdentity,input:{operation_id:string;role:'ceo'|'reviewer'|'knowledge';request:string}){
 if(!firmEnabled())throw Error('FIRM_UNAVAILABLE');
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for('update');
  const [credential]=await tx.select().from(caseToolCredentials).where(eq(caseToolCredentials.id,identity.id));
  const [authority]=credential?.authority_id?await tx.select().from(caseAuthorities).where(eq(caseAuthorities.id,credential.authority_id)):[];
  if(!item||!credential||credential.case_id!==item.id||credential.issued_by!==item.owner_id||credential.revoked_at||!authority||authority.case_id!==item.id||authority.approved_by!==item.owner_id||!['active','waiting'].includes(authority.state))throw Error('INVALID_CASE_BINDING');
  const event_key=`advocate-help:${input.operation_id}`;
  const [prior]=await tx.select().from(firmEvents).where(eq(firmEvents.event_key,event_key));
  if(prior){if(prior.case_id!==item.id||prior.role!==input.role||prior.payload.request!==input.request)throw Error('OPERATION_CONFLICT');return {event_id:prior.id,state:prior.state};}
  await queueFirmEvent(tx,{role:input.role,event_key,kind:'advocate_request',case_id:item.id,payload:{request:input.request,authority_id:authority.id}});
  const [event]=await tx.select().from(firmEvents).where(eq(firmEvents.event_key,event_key));return {event_id:event.id,state:event.state};
 });
}
