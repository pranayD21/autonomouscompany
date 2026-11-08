export type Message={role:"system"|"user"|"assistant"|"tool";content:string|null;tool_calls?:Call[];tool_call_id?:string};
export type Call={id:string;type:"function";function:{name:string;arguments:string}};
export type State={version:1;caseId:string;messages:Message[];pending:{call:Call;started:boolean}[];turns:number};
export type Tool={name:string;description?:string;inputSchema:Record<string,unknown>};
export type Dependencies={model:(messages:Message[],tools:Tool[])=>Promise<Message>;tool:(name:string,args:Record<string,unknown>)=>Promise<unknown>;save:(state:State)=>Promise<void>};
// Persist dispatch intent before executing. A crash/timeout needs reconciliation, never blind replay.
export async function runDemoTurn(state:State,tools:Tool[],deps:Dependencies){
 const names=new Set(tools.map(t=>t.name));
 while(true){
  while(state.pending.length){
   const item=state.pending[0];
   if(item.started)throw Error(`DEMO_TOOL_RECONCILIATION_REQUIRED:${item.call.id}`);
   let args:Record<string,unknown>;
   try{args=JSON.parse(item.call.function.arguments);if(!args||Array.isArray(args)||typeof args!=="object")throw Error();}catch{throw Error("INVALID_MODEL_TOOL_ARGUMENTS");}
   if(!names.has(item.call.function.name)||args.case_id!==state.caseId)throw Error("DEMO_CASE_OR_TOOL_MISMATCH");
   item.started=true;await deps.save(state);
   const result=await deps.tool(item.call.function.name,args);
   state.messages.push({role:"tool",tool_call_id:item.call.id,content:JSON.stringify(result)});
   state.pending.shift();await deps.save(state);
  }
  const message=await deps.model(state.messages,tools);
  if(message.role!=="assistant")throw Error("INVALID_MODEL_RESPONSE");
  const calls=message.tool_calls??[];
  if(calls.some(c=>!c.id||c.type!=="function")||new Set(calls.map(c=>c.id)).size!==calls.length)throw Error("INVALID_MODEL_TOOL_CALLS");
  state.messages.push(message);state.pending=calls.map(call=>({call,started:false}));state.turns++;await deps.save(state);
  if(!calls.length)return message.content??"";
 }
}
export function directModel(key:string,model:string,send:typeof fetch=fetch):Dependencies["model"]{
 return async(messages,tools)=>{
  const response=await send("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,parallel_tool_calls:false,tools:tools.map(t=>({type:"function",function:{name:t.name,description:t.description,parameters:t.inputSchema}}))})});
  if(!response.ok)throw Error(`DEMO_MODEL_HTTP_${response.status}`);
  const body=await response.json();const choice=body.choices?.[0];
  if(!choice||!["stop","tool_calls"].includes(choice.finish_reason))throw Error("DEMO_MODEL_INCOMPLETE");
  return {role:"assistant",content:choice.message.content??null,...(choice.message.tool_calls?{tool_calls:choice.message.tool_calls}:{})};
 };
}
