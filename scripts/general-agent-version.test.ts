import {test} from "node:test";
import assert from "node:assert/strict";
import {crewConfiguration,startCrew} from "../backend/providers/naive";
import {startCaseDecision} from "../backend/providers/autonomy";
process.env.NAIVE_API_KEY="synthetic-key";process.env.NAIVE_COORDINATOR_ID="agt_synthetic";process.env.NAIVE_RUN_BUDGET_MICRO_USD="250000";
test("general sessions fail closed without an explicit immutable version or with excessive task budget",()=>{
 for(const version of [undefined,"","0","-1","1.5","latest"]){if(version===undefined)delete process.env.NAIVE_GENERAL_AGENT_VERSION;else process.env.NAIVE_GENERAL_AGENT_VERSION=version;assert.equal(crewConfiguration(),null);}
 process.env.NAIVE_GENERAL_AGENT_VERSION="21";assert.equal(crewConfiguration()?.agentVersion,21);
 process.env.NAIVE_RUN_BUDGET_MICRO_USD="250001";assert.equal(crewConfiguration(),null);process.env.NAIVE_RUN_BUDGET_MICRO_USD="250000";
});
test("reviews and bounded decisions submit the pinned version rather than the changing provider default",async t=>{
 const requests:Record<string,unknown>[]=[];
 t.mock.method(globalThis,"fetch",async(_url:unknown,init:RequestInit)=>{requests.push(JSON.parse(String(init.body)));throw Error("Captured test request; no network");});
 await assert.rejects(()=>startCrew("synthetic-run","synthetic-case",JSON.stringify({bill_cents:null,eob_cents:null})),/Captured test request/);
 await assert.rejects(()=>startCaseDecision("synthetic-decision",{}),/Captured test request/);
 assert.equal(requests.length,2);for(const request of requests){assert.equal(request.agent_version,21);assert.equal(request.agent_id,"agt_synthetic");assert.equal(request.budget_micro_usd,250000);}
});
