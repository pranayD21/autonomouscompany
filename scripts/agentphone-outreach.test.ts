import {test} from "node:test";
import assert from "node:assert/strict";
import {sendOutreach,readOutreach,outreachEnabled,DispatchFailure} from "../backend/providers/outreach";
import type {OutreachAction} from "../backend/schema";
const action={id:"synthetic-action",kind:"call",destination:"+12025550123",body:"Ask for fictional claim status."} as OutreachAction;
process.env.OUTREACH_VOICE_PROVIDER="agentphone";
process.env.AGENTPHONE_API_KEY="test-only";
process.env.AGENTPHONE_AGENT_ID="test-agent";
process.env.AGENTPHONE_NUMBER_ID="test-number";
test("explicit AgentPhone selection calls directly without ElevenLabs",async()=>{
 let calls=0;assert.equal(outreachEnabled("call"),true);
 const result=await sendOutreach(action,(async(url,init)=>{
  calls++;assert.equal(String(url),"https://api.agentphone.ai/v1/calls");
  assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer test-only");
  const body=JSON.parse(String(init?.body));assert.equal(body.toNumber,action.destination);assert.equal(body.disableRecording,true);assert.equal(body.agentId,"test-agent");assert.ok(body.systemPrompt.includes(JSON.stringify(action.body)));
  return Response.json({id:"direct-call",status:"queued"});
 }) as typeof fetch);
 assert.equal(calls,1);assert.equal(result.provider_id,"direct-call");
});
test("AgentPhone timeout never retries or crosses providers",async()=>{
 let calls=0;await assert.rejects(()=>sendOutreach(action,(async()=>{calls++;throw new Error("timeout");}) as typeof fetch),/timeout/);assert.equal(calls,1);
});
test("invalid routing disables calls, rather than selecting a funded provider",()=>{
 process.env.OUTREACH_VOICE_PROVIDER="typo";try{assert.equal(outreachEnabled("call"),false);}finally{process.env.OUTREACH_VOICE_PROVIDER="agentphone";}
});
test("missing receipt is uncertain and does not cause another call",async()=>{
 let calls=0;await assert.rejects(()=>sendOutreach(action,(async()=>{calls++;return Response.json({status:"queued"});}) as typeof fetch),(e:unknown)=>e instanceof DispatchFailure&&!e.definiteRejection);assert.equal(calls,1);
});
test("ElevenLabs receipt keeps its provider after selection changes",async()=>{
 const result=await readOutreach({...action,provider_id:"elevenlabs:previous-call"},(async url=>{assert.equal(String(url),"https://api.elevenlabs.io/v1/convai/conversations/previous-call");return Response.json({conversation_id:"previous-call",agent_id:"old-agent",status:"done",metadata:{call_duration_secs:12}});}) as typeof fetch);assert.equal(result.duration_seconds,12);
});
