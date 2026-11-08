import {test} from "node:test";
import assert from "node:assert/strict";
import {capacityFetch,NaiveDeferred,retryAfterMs,type CapacityStore} from "../backend/providers/naive-capacity";
test("shared cooldown defers without contacting Naïve",async()=>{
 let sent=0;const store:CapacityStore={acquire:async()=>({acquired:false,waitMs:60000}),release:async()=>{throw Error("No lease");}};
 await assert.rejects(()=>capacityFetch(store,async()=>{sent++;return new Response();})("https://api.vetta.sh/v1/sessions"),NaiveDeferred);assert.equal(sent,0);
});
test("429 retains response and records cooldown without replaying a POST",async()=>{
 let sent=0;const releases:unknown[][]=[];const store:CapacityStore={acquire:async()=>({acquired:true,waitMs:0}),release:async(...args)=>{releases.push(args);}};
 const headers={"retry-after":"120","x-request-id":"capacity-fixture"};
 const result=await capacityFetch(store,async(_url,init)=>{sent++;assert.equal(new Headers(init?.headers).get("idempotency-key"),"existing-event");return new Response("busy",{status:429,headers});})("https://api.vetta.sh/v1/sessions",{method:"POST",headers:{"idempotency-key":"existing-event"}});
 assert.equal(result.status,429);assert.equal(await result.text(),"busy");assert.equal(sent,1);assert.deepEqual(releases[0].slice(1),[429,120000,"capacity-fixture"]);
});
test("uncertain network outcomes release with a cooldown and never replay",async()=>{
 let sent=0;let status:unknown=1;const store:CapacityStore={acquire:async()=>({acquired:true,waitMs:0}),release:async(_token,s)=>{status=s;}};
 await assert.rejects(()=>capacityFetch(store,async()=>{sent++;throw Error("Timeout");})("https://api.vetta.sh/v1/sessions",{method:"POST"}),/Timeout/);assert.equal(sent,1);assert.equal(status,null);
});
test("Retry-After accepts seconds and HTTP dates",()=>{
 assert.equal(retryAfterMs("90"),90000);assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT",0),60000);assert.equal(retryAfterMs("nonsense"),null);
});
