import {test} from "node:test";
import assert from "node:assert/strict";
import {caseInput,potentialDifference} from "../backend/claim-input";
import {completedCrewSnapshot} from "../backend/providers/crew-result";
const intake={contact_name:"Synthetic worker",contact_email:"worker@example.com",injury_description:"Chemical burn at a fictional workplace."};
test("workplace case can start before employer, insurer, bill, or EOB is known",()=>{
 const c=caseInput.parse({title:"Workplace burn",case_type:"workplace_injury",intake});
 assert.equal(c.bill_cents,null);assert.equal(c.eob_cents,null);assert.equal(c.intake.employer_name,"");assert.equal(c.intake.claim_stage,"unknown");
});
test("unknown and explicit zero amounts stay distinct",()=>{
 assert.equal(potentialDifference(null,0),null);assert.equal(potentialDifference(0,null),null);assert.equal(potentialDifference(0,0),0);assert.equal(potentialDifference(120000,40000),80000);
});
test("workplace intake requires claimant contact and incident description",()=>{
 for(const incomplete of [{},{...intake,contact_email:""},{...intake,injury_description:""}])assert.equal(caseInput.safeParse({title:"Work injury",case_type:"workplace_injury",intake:incomplete}).success,false);
});
test("invalid contact/date and negative amount are rejected",()=>{
 for(const patch of [{contact_email:"not-email"},{incident_date:"2026-02-30"},{contact_phone:"call-me"}])assert.equal(caseInput.safeParse({title:"Burn",case_type:"workplace_injury",intake:{...intake,...patch}}).success,false);
 assert.equal(caseInput.safeParse({title:"Bill",bill_cents:-1}).success,false);
});
test("old bill input remains compatible",()=>{
 const c=caseInput.parse({title:"Legacy bill",bill_cents:120000,eob_cents:40000});assert.equal(c.case_type,"health_insurance");assert.equal(c.intake.injury_description,"");
});
test("a completed model result cannot turn unknown amounts into a zero discrepancy",()=>{
 const result={summary:"Missing claim evidence",potential_discrepancy_cents:0,evidence:["claim_intake"],missing_information:["Employer insurer"],next_actions:["Request coverage details"],human_help_required:true,human_help_reason:"Missing information"};
 const session={status:"idle",stop_reason:"end_turn",consumed_micro_usd:1,structured_output:result,pending_actions:[]};
 assert.equal(completedCrewSnapshot(session,null).output_valid,false);
 assert.equal(completedCrewSnapshot({...session,structured_output:{...result,potential_discrepancy_cents:null}},null).output_valid,true);
});
