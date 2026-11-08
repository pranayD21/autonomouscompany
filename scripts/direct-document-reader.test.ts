import {test} from "node:test";
import assert from "node:assert/strict";
import {readDocumentDirect} from "../backend/providers/direct-document-reader";
const output={visible_text:"Fictional Plan",insurer_name:"Fictional Plan",member_name:null,member_id:null,group_number:null,claim_number:null,uncertainties:["No member fields visible"]};
test("direct reader sends the exact image bytes and accepts only complete schema-valid output",async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY="test-only";
 try{let calls=0;const result=await readDocumentDirect(new Uint8Array([1,2,3]),"image/png",async(url,init)=>{
  calls++;assert.equal(url,"https://api.openai.com/v1/chat/completions");const body=JSON.parse(String(init?.body));
  assert.equal(body.messages[1].content[0].image_url.url,"data:image/png;base64,AQID");
  assert.equal(body.response_format.json_schema.strict,true);assert.match(body.messages[0].content,/untrusted evidence/);
  return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(output)}}]});
 });assert.deepEqual(result,output);assert.equal(calls,1);
 for(const body of [{choices:[{finish_reason:"length",message:{content:JSON.stringify(output)}}]},{choices:[{finish_reason:"stop",message:{refusal:"no",content:JSON.stringify(output)}}]},{choices:[{finish_reason:"stop",message:{content:'{"visible_text":"invented"}'}}]}])await assert.rejects(()=>readDocumentDirect(new Uint8Array([1]),"image/png",async()=>Response.json(body)));
 await assert.rejects(()=>readDocumentDirect(new Uint8Array([1]),"image/png",async()=>new Response("",{status:429})),/HTTP_429/);
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
