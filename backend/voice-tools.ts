import {createHash,timingSafeEqual} from 'node:crypto';
import {Hono} from 'hono';
import {z} from 'zod';
import type {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {readCaseAutonomy} from './autonomy-service';
import {readCaseConversation,sendCaseMessage} from './case-messages';

type Options={request?:typeof fetch};
type LiveCall={id:string;phone:string};
type OpenCase={id:string;title:string;case_type:string;created_at:Date};

const secretMatches=(given:string|undefined)=>{
 const expected=process.env.AGENTPHONE_TOOL_SECRET;if(!expected||!given)return false;
 const a=createHash('sha256').update(given).digest(),b=createHash('sha256').update(expected).digest();
 return timingSafeEqual(a,b);
};
const messageId=(callId:string,text:string)=>{const h=createHash('sha256').update(`${callId}:${text}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};

// The tool request's contents are not documented, so the caller comes from the provider's list of live calls on this line.
// With several live calls and no matching number in the request, the caller stays unknown and nothing is revealed.
async function liveCall(request:typeof fetch,body:Record<string,unknown>):Promise<LiveCall|null>{
 const response=await request('https://api.agentphone.ai/v1/calls?direction=inbound&status=in-progress&limit=20',{headers:{Authorization:`Bearer ${process.env.AGENTPHONE_API_KEY}`},signal:AbortSignal.timeout(6000)});
 if(!response.ok)return null;
 const data=await response.json();
 const live=(Array.isArray(data.data)?data.data:[]).filter((c:{agentId?:string;phoneNumberId?:string;fromNumber?:string;direction?:string})=>c.agentId===process.env.AGENTPHONE_AGENT_ID&&c.phoneNumberId===process.env.AGENTPHONE_NUMBER_ID&&c.direction==='inbound'&&!!c.fromNumber);
 const nested=(body.call&&typeof body.call==='object'?body.call:{}) as Record<string,unknown>;
 const claimed=[nested.from_number,nested.fromNumber,body.from_number,body.fromNumber].find(v=>typeof v==='string');
 const call=(claimed?live.find((c:{fromNumber:string})=>c.fromNumber===claimed):undefined)??(live.length===1?live[0]:undefined);
 return call?{id:call.id,phone:call.fromNumber}:null;
}
async function callerOwner(pool:Pool,phone:string){
 const {rows:[user]}=await pool.query<{id:string;linked_owner_id:string|null}>('SELECT id,linked_owner_id FROM advocacy_phone_users WHERE phone_number=$1 AND phone_number_verified=true',[phone]);
 return user?user.linked_owner_id??`phone:${user.id}`:null;
}
async function openCases(pool:Pool,owner:string){
 const {rows}=await pool.query<OpenCase>("SELECT c.id,c.title,c.case_type,c.created_at FROM advocacy_cases c WHERE c.owner_id=$1 AND EXISTS(SELECT 1 FROM advocacy_case_authorities a WHERE a.case_id=c.id AND a.state IN ('active','waiting','human_required')) ORDER BY c.created_at",[owner]);
 return rows;
}
const caseKind=(type:string)=>type==='workplace_injury'?'workplace injury':'health insurance';
// A call that reached a specific case is about that case, so it must not also open a new one afterward.
const markExisting=(pool:Pool,callId:string,owner:string,caseId:string)=>pool.query("INSERT INTO advocacy_phone_call_cases(call_id,owner_id,case_id,state,reason) VALUES($1,$2,$3,'about_existing','That call was about your existing case.') ON CONFLICT(call_id) DO NOTHING",[callId,owner,caseId]);

export function voiceToolRoutes(pool:Pool,options:Options={}){
 const app=new Hono();
 const db=drizzle(pool);
 app.post('/:tool',async c=>{
  if(!process.env.AGENTPHONE_TOOL_SECRET)return c.json({error:'Unavailable.'},503);
  if(!secretMatches(c.req.header('x-assurance-tool-secret')))return c.json({error:'Unauthorized.'},401);
  c.header('Cache-Control','no-store');
  const raw=await c.req.text();if(raw.length>16_384)return c.json({error:'Too large.'},413);
  let body:Record<string,unknown>={};try{const parsed=JSON.parse(raw||'{}');if(parsed&&typeof parsed==='object')body=parsed;}catch{return c.json({error:'Invalid request.'},400);}
  const args=(body.args&&typeof body.args==='object'?body.args:body) as Record<string,unknown>;
  const tool=c.req.param('tool');
  if(!['get_open_cases','get_case_details','save_case_update'].includes(tool))return c.json({error:'Unknown tool.'},404);
  const call=await liveCall(options.request??fetch,body).catch(()=>null);
  const owner=call?await callerOwner(pool,call.phone):null;
  if(!call||!owner){
   if(tool==='get_open_cases')return c.json({caller_known:false,count:0,cases:[]});
   return c.json({caller_known:false,error:'This call could not be matched to an account.'});
  }
  const cases=await openCases(pool,owner);
  if(tool==='get_open_cases')return c.json({caller_known:true,count:cases.length,cases:cases.map((item,index)=>({case_number:index+1,title:item.title,type:caseKind(item.case_type),opened:new Date(item.created_at).toDateString()}))});
  const number=z.coerce.number().int().positive().safeParse(args.case_number);
  const item=number.success?cases[number.data-1]:undefined;
  if(!item)return c.json({caller_known:true,error:'That case number was not found. Call get_open_cases again.'});
  await markExisting(pool,call.id,owner,item.id);
  if(tool==='get_case_details'){
   const [{rows:[detail]},autonomy,conversation]=await Promise.all([pool.query<{description:string|null}>("SELECT intake->>'injury_description' AS description FROM advocacy_cases WHERE id=$1",[item.id]),readCaseAutonomy(db,item.id,owner),readCaseConversation(db,item.id)]);
   const session=autonomy.sessions[0] as {state?:string;goal?:string|null;waiting_on?:string|null}|undefined;
   // Member IDs, claim numbers, and document contents stay out of the voice context.
   return c.json({caller_known:true,title:item.title,type:caseKind(item.case_type),opened:new Date(item.created_at).toDateString(),what_was_reported:(detail?.description??'').slice(0,800),advocate:session?{state:session.state,goal:session.goal??null,waiting_on:session.waiting_on??null}:{state:'getting started'},recent_messages:conversation.slice(-5).map(m=>({from:m.role==='user'?'caller':'advocate',text:m.text.slice(0,300)}))});
  }
  const update=z.string().trim().min(1).max(3900).safeParse(args.update);
  if(!update.success)return c.json({caller_known:true,saved:false,error:'No update was provided.'});
  try{await sendCaseMessage(db,item.id,owner,{id:messageId(call.id,update.data),text:`By phone: ${update.data}`});return c.json({caller_known:true,saved:true});}
  catch{return c.json({caller_known:true,saved:false,error:'The update could not be saved.'});}
 });
 return app;
}
