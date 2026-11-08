import {test} from "node:test";
import assert from "node:assert/strict";
import {caseAuthority,caseDecision,checkCaseDecision,type CaseAuthority,type CaseDecision,type DecisionContext} from "../backend/autonomy-policy";
const authority:CaseAuthority={synthetic:true,goal:"Gather missing fictional employer and incident details",contacts:[{id:"customer",role:"customer",channel:"email",destination:"demo@example.com"}],max_decisions:3,max_outbound:2,min_contact_interval_minutes:60,expires_at:"2026-11-09T00:00:00.000Z"};
const context:DecisionContext={now:new Date("2026-11-08T00:00:00Z"),revoked:false,decisions_used:1,outbound_used:0,last_contact_at:null,evidence_refs:["case:1"],verified_goal_met:false,customer_requested_stop:false,uncertain_dispatch:false,call_enabled:false};
const contact:CaseDecision={tool:"contact_customer",contact_id:"customer",subject:"Synthetic question",body:"Which fictional employer should we use?",reason:"Missing employer",evidence_refs:["case:1"]};
test("standing authority permits a scoped customer contact without per-message approval",()=>assert.equal(checkCaseDecision(authority,contact,context),null));
test("the model cannot change recipient role, destination, evidence, or enabled channel",()=>{
 assert.equal(checkCaseDecision(authority,{...contact,tool:"contact_insurer"},context),"CONTACT_NOT_AUTHORIZED");
 assert.equal(checkCaseDecision(authority,{...contact,contact_id:"unapproved"},context),"CONTACT_NOT_AUTHORIZED");
 assert.equal(checkCaseDecision(authority,{...contact,evidence_refs:["invented"]},context),"UNKNOWN_EVIDENCE");
 assert.equal(caseDecision.safeParse({...contact,destination:"other@example.com"}).success,false);
 assert.equal(checkCaseDecision({...authority,contacts:[{...authority.contacts[0],channel:"call",destination:"+15085550100"}]},contact,context),"CALL_NOT_ENABLED");
});
test("revocation, expiry, action limits, and uncertain dispatch prevent another message",()=>{
 for(const [patch,reason] of [[{revoked:true},"AUTHORIZATION_REVOKED"],[{now:new Date("2026-11-10")},"AUTHORIZATION_EXPIRED"],[{outbound_used:2},"OUTBOUND_LIMIT"],[{decisions_used:4},"DECISION_LIMIT"],[{uncertain_dispatch:true},"DISPATCH_NEEDS_RECONCILIATION"],[{customer_requested_stop:true},"CUSTOMER_STOPPED"]] as [Partial<DecisionContext>,string][])
  assert.equal(checkCaseDecision(authority,contact,{...context,...patch}),reason);
 assert.equal(checkCaseDecision(authority,contact,{...context,last_contact_at:new Date("2026-11-07T23:59:00Z")}),"CONTACT_TOO_SOON");
});
test("waiting and asking for help do not fabricate a successful outcome",()=>{
 assert.equal(checkCaseDecision(authority,{tool:"wait_for_reply",minutes:60,reason:"Await reply",evidence_refs:[]},context),null);
 const stop:CaseDecision={tool:"stop_case",outcome:"goal_met",summary:"Done",reason:"Complete",evidence_refs:["case:1"]};
 assert.equal(checkCaseDecision(authority,stop,context),"OUTCOME_NOT_VERIFIED");
 assert.equal(checkCaseDecision(authority,stop,{...context,verified_goal_met:true}),null);
 assert.equal(checkCaseDecision(authority,{...stop,outcome:"customer_requested_stop"},context),"STOP_REQUEST_NOT_VERIFIED");
 assert.equal(checkCaseDecision(authority,{tool:"request_human_help",question:"Please reconcile the receipt",reason:"Unknown dispatch",evidence_refs:[]},{...context,uncertain_dispatch:true}),null);
});
test("authority rejects ambiguous contacts and malformed addresses",()=>{
 assert.equal(caseAuthority.safeParse(authority).success,true);
 assert.equal(caseAuthority.safeParse({...authority,contacts:[...authority.contacts,...authority.contacts]}).success,false);
 assert.equal(caseAuthority.safeParse({...authority,contacts:[{...authority.contacts[0],destination:"not an address"}]}).success,false);
});

test("synthetic completion requires current recorded outcome evidence and never verifies real success",()=>{
 const stop:CaseDecision={tool:"stop_case",outcome:"synthetic_demo_completed",summary:"Fictional scenario complete",reason:"Recorded synthetic result",evidence_refs:["outcome:demo"]};
 const ctx={...context,evidence_refs:["outcome:demo"],current_outcome_refs:["outcome:demo"]};
 assert.equal(checkCaseDecision(authority,stop,ctx),null);
 assert.equal(checkCaseDecision(authority,stop,{...ctx,current_outcome_refs:[]}),"CURRENT_OUTCOME_REQUIRED");
 assert.equal(checkCaseDecision(authority,{...stop,evidence_refs:[]},ctx),"CURRENT_OUTCOME_REQUIRED");
 assert.equal(checkCaseDecision(authority,stop,{...ctx,uncertain_dispatch:true}),"DISPATCH_NEEDS_RECONCILIATION");
 assert.equal(checkCaseDecision(authority,{...stop,outcome:"goal_met"},ctx),"OUTCOME_NOT_VERIFIED");
});

test("research-only authority permits zero contacts and rejects all outbound actions",()=>{
 const research={...authority,contacts:[],max_outbound:0};
 assert.equal(caseAuthority.safeParse(research).success,true);
 assert.equal(caseAuthority.safeParse({...research,max_outbound:1}).success,false);
 assert.equal(checkCaseDecision(research,contact,context),"OUTBOUND_LIMIT");
});
