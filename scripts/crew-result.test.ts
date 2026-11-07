import { test } from "node:test";
import assert from "node:assert/strict";
import { completedCrewSnapshot } from "../backend/providers/crew-result";
const output={summary:"Unverified difference",potential_discrepancy_cents:80000,evidence:["bill_amount"],missing_information:["Full EOB"],next_actions:["Request documents"],human_help_required:true,human_help_reason:"Authorization needed"};
const session={status:"idle",stop_reason:"end_turn",consumed_micro_usd:10,structured_output:output,pending_actions:[]};
test("completed valid output can be saved",()=>assert.equal(completedCrewSnapshot(session).output_valid,true));
test("early submission during delegation must not become a final case plan",()=>{
 const result=completedCrewSnapshot({...session,stop_reason:"awaiting_delegation"});
 assert.equal(result.output_valid,false);assert.equal(result.result,null);
});
test("error and pending human approval cannot become final plans",()=>{
 for(const override of [{stop_reason:"error"},{pending_actions:[{id:"approval"}]}]) assert.equal(completedCrewSnapshot({...session,...override}).result,null);
});
test("unrecognized evidence and malformed output fail closed",()=>{
 assert.equal(completedCrewSnapshot({...session,structured_output:{...output,evidence:["agent opinion"]}}).result,null);
 assert.equal(completedCrewSnapshot({...session,structured_output:null}).result,null);
});
