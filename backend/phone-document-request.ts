import {isOpenCasePermission,caseIsOpen} from './open-case-policy';
import {and,eq} from 'drizzle-orm';import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {cases,caseAuthorities} from './schema';import {phonePreferences,phoneNotifications} from './phone-schema';import {portalUrl} from './phone-messaging';import type {CaseToolIdentity} from './case-tools';
export type PhoneDocumentRequest={operation_id:string;authority_id:string;kind:'insurance_card'|'bill'|'eob'|'incident'};
export async function requestPhoneDocument(db:NodePgDatabase,identity:CaseToolIdentity,input:PhoneDocumentRequest){
 if(process.env.PHONE_FLOW_ENABLED!=='true')throw Error('PHONE_FLOW_DISABLED');
 return db.transaction(async tx=>{
  const [item]=await tx.select().from(cases).where(and(eq(cases.id,identity.case_id),eq(cases.owner_id,identity.owner_id))).for('update');
  const [authority]=await tx.select().from(caseAuthorities).where(and(eq(caseAuthorities.id,input.authority_id),eq(caseAuthorities.case_id,identity.case_id))).for('update');
  const [pref]=await tx.select().from(phonePreferences).where(eq(phonePreferences.owner_id,identity.owner_id));
  const active=authority&&(isOpenCasePermission(authority.policy)?caseIsOpen(authority.state):['active','waiting'].includes(authority.state)&&new Date(authority.policy.expires_at)>new Date());
  if(!item||!authority||authority.approved_by!==identity.owner_id||!active||!pref?.sms_consent)throw Error('DOCUMENT_REQUEST_NOT_AUTHORIZED');
  const key=`document-request:${item.id}:${input.kind}`;const [existing]=await tx.select().from(phoneNotifications).where(eq(phoneNotifications.dedupe_key,key));
  if(existing)return {id:existing.id,state:existing.state,delivery_verified:false};
  const body=`Assurance: Please add the ${input.kind.replaceAll('_',' ')} to your case. Upload securely at ${portalUrl(item.id)} Reply STOP to stop case texts.`;
  const [saved]=await tx.insert(phoneNotifications).values({dedupe_key:key,owner_id:identity.owner_id,case_id:item.id,kind:'document_request',body,reason:input.kind}).returning();
  return {id:saved.id,state:'queued',delivery_verified:false};
 });
}
