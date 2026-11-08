import {test} from "node:test";
import assert from "node:assert/strict";
import {shortCaseTitle} from "../backend/case-title";
const long="I was at the office and then I got a chemical burner while working at one of the wet labs.";
const reply=(content:string)=>async()=>Response.json({choices:[{message:{content}}]});
async function withKey(fn:()=>Promise<void>){const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY="test-only";try{await fn();}finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}}

test("long titles are shortened by the small model",()=>withKey(async()=>{
 let body:any;
 const out=await shortCaseTitle(long,long,async(_u,init)=>{body=JSON.parse(String(init?.body));return reply('"Chemical burn in wet lab."')();});
 assert.equal(out,"Chemical burn in wet lab");
 assert.equal(body.model,"gpt-5.4-nano");assert.match(body.messages[0].content,/untrusted/);
}));
test("short titles and missing keys never call the model",async()=>{
 const never=async()=>{throw Error("called");};
 await withKey(async()=>assert.equal(await shortCaseTitle("Chemical burn at work",undefined,never),"Chemical burn at work"));
 const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 try{assert.equal(await shortCaseTitle(long,long,never),long);}finally{if(old!==undefined)process.env.OPENAI_API_KEY=old;}
});
test("failures and unusable replies keep the original title",()=>withKey(async()=>{
 assert.equal(await shortCaseTitle(long,long,async()=>{throw Error("network");}),long);
 assert.equal(await shortCaseTitle(long,long,async()=>new Response("no",{status:500})),long);
 assert.equal(await shortCaseTitle(long,long,reply("")),long);
 assert.equal(await shortCaseTitle(long,long,reply("one two three four five six seven eight nine ten")),long);
}));
