import {test} from "node:test";
import assert from "node:assert/strict";
import {sendOutreach,readOutreach,outreachEnabled} from "../backend/providers/outreach";
import type {OutreachAction} from "../backend/schema";
const action={id:"synthetic-action",kind:"call",destination:"+12025550123",body:"Ask whether the fictional claim needs more documents."} as OutreachAction;
test("ElevenLabs/Twilio selection is disabled for new calls even when configured",async()=>{
 process.env.OUTREACH_VOICE_PROVIDER="elevenlabs";
 process.env.ELEVENLABS_API_KEY="test-only";process.env.ELEVENLABS_OUTREACH_AGENT_ID="old-agent";process.env.ELEVENLABS_PHONE_NUMBER_ID="old-number";
 let requests=0;assert.equal(outreachEnabled("call"),false);
 await assert.rejects(()=>sendOutreach(action,(async()=>{requests++;throw Error("Must not call");}) as typeof fetch),/VOICE_NOT_CONFIGURED/);
 assert.equal(requests,0);delete process.env.OUTREACH_VOICE_PROVIDER;
});
test("status reads return only status and duration and enforce receipt identity",async()=>{
 const saved={...action,provider_id:"elevenlabs:conv-test"};
 const result=await readOutreach(saved,(async(url,init)=>{assert.ok(String(url).endsWith("/conversations/conv-test"));assert.equal(init?.method,undefined);return Response.json({conversation_id:"conv-test",agent_id:"test-agent",status:"done",metadata:{call_duration_secs:46},transcript:[{message:"not retained"}]});}) as typeof fetch);
 assert.deepEqual(result,{provider_status:"completed",duration_seconds:46});
 await assert.rejects(()=>readOutreach(saved,(async()=>Response.json({conversation_id:"wrong",agent_id:"test-agent",status:"done",metadata:{}})) as typeof fetch),/receipt mismatch/);
});
test("legacy receipts still read AgentPhone without changing new-call routing",async()=>{
 const result=await readOutreach({...action,provider_id:"legacy-call"},(async(url,init)=>{assert.equal(init?.method,undefined);assert.equal(String(url),"https://api.agentphone.ai/v1/calls/legacy-call");return Response.json({id:"legacy-call",status:"completed",durationSeconds:46});}) as typeof fetch);
 assert.equal(result.provider_status,"completed");
});
