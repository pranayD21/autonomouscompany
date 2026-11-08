import {test} from "node:test";
import assert from "node:assert/strict";
import {sendOutreach,readOutreach,outreachEnabled,DispatchFailure} from "../backend/providers/outreach";
import {elevenLabsOutreachPrompt} from "../backend/providers/voice-config";
import type {OutreachAction} from "../backend/schema";
const action={id:"synthetic-action",kind:"call",destination:"+12025550123",body:"Ask whether the fictional claim needs more documents."} as OutreachAction;
const safeAgent={conversation_config:{agent:{prompt:{prompt:elevenLabsOutreachPrompt}},conversation:{max_duration_seconds:180}},platform_settings:{privacy:{record_voice:false},auth:{enable_auth:true}}};
process.env.ELEVENLABS_API_KEY="test-only";process.env.ELEVENLABS_OUTREACH_AGENT_ID="test-agent";process.env.ELEVENLABS_PHONE_NUMBER_ID="test-number";
test("outbound uses ElevenLabs/Twilio, reviewed plan, no recordings, and both receipts",async()=>{
 const urls:string[]=[];
 const result=await sendOutreach(action,(async(url,init)=>{
  urls.push(String(url));assert.ok(String(url).startsWith("https://api.elevenlabs.io/"));assert.equal(new Headers(init?.headers).get("xi-api-key"),"test-only");
  if(!init?.method)return Response.json(safeAgent);
  const body=JSON.parse(String(init.body));assert.equal(body.to_number,action.destination);assert.equal(body.agent_id,"test-agent");assert.equal(body.agent_phone_number_id,"test-number");
  assert.equal(body.call_recording_enabled,false);assert.equal(body.telephony_call_config.twilio_call_recording_enabled,false);assert.equal(body.conversation_initiation_client_data.dynamic_variables.discussion_plan,JSON.stringify(action.body));
  return Response.json({success:true,conversation_id:"conv-test",callSid:"CA-test"});
 }) as typeof fetch);
 assert.equal(urls.length,2);assert.deepEqual(result,{provider_id:"elevenlabs:conv-test",provider_thread_id:"CA-test",provider_status:"initiated"});
});
test("unsafe agent settings reject before dialing",async()=>{
 let attempts=0;
 await assert.rejects(()=>sendOutreach(action,(async(_url,init)=>{if(init?.method)attempts++;return Response.json({...safeAgent,platform_settings:{privacy:{record_voice:true},auth:{enable_auth:true}}});}) as typeof fetch),/VOICE_AGENT_CONFIGURATION_MISMATCH/);
 assert.equal(attempts,0);
});
test("ambiguous response is not retried or treated as definite refusal",async()=>{
 let posts=0;try{await sendOutreach(action,(async(_url,init)=>{if(!init?.method)return Response.json(safeAgent);posts++;return Response.json({success:false,conversation_id:null,callSid:"CA-maybe"});}) as typeof fetch);assert.fail("Expected failure");}catch(e){assert.ok(e instanceof DispatchFailure);assert.equal(e.definiteRejection,false);}assert.equal(posts,1);
});
test("missing number disables calls despite legacy AgentPhone configuration",async()=>{
 const id=process.env.ELEVENLABS_PHONE_NUMBER_ID;delete process.env.ELEVENLABS_PHONE_NUMBER_ID;process.env.AGENTPHONE_API_KEY="legacy";
 try{assert.equal(outreachEnabled("call"),false);await assert.rejects(()=>sendOutreach(action,(async()=>{throw new Error("Must not request provider");}) as typeof fetch),/VOICE_NOT_CONFIGURED/);}finally{process.env.ELEVENLABS_PHONE_NUMBER_ID=id;}
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
