import {mkdirSync, writeFileSync, unlinkSync} from "node:fs";
import {createServer} from "vite";

const path = "test-results/claim-page-fixture.html";
mkdirSync("test-results", {recursive: true});
writeFileSync(path, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="surface"><div id="root"></div></main><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CaseView} from '/src/Workspace.tsx';
import {auth} from '/src/services.ts';
import '/src/style.css';
const caseId='11111111-1111-4111-8111-111111111111', owner='fictional-claim-page';
const now=new Date().toISOString();
const messages=[{id:'fictional-assistant',role:'assistant',text:'Please upload the claim letter you received. I can use it to check the reason for the decision and what information is needed next.',created_at:now,kind:'document_request'}];
const documents=[];
window.fixture={posts:[],uploads:[],failNext:false,state:'human_required',empty:false,blocked:false,failUpload:false};
auth.getSession=async()=>({data:{user:{id:owner},session:{token:'fictional-fixture-token'}},error:null});
window.fetch=async(input,options={})=>{
 const url=new URL(String(input),location.href), method=options.method??'GET';
 if(url.origin!==new URL(import.meta.env.VITE_CASES_API_URL).origin)throw Error('Fixture blocked unexpected fetch');
 const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 if(url.pathname.endsWith('/messages')){
  if(method==='POST'){
   const request=JSON.parse(options.body);window.fixture.posts.push(request);
   if(window.fixture.failNext){window.fixture.failNext=false;return respond({error:'Fictional save failed. Retry the same message.'},503);}
   if(!messages.some(message=>message.id===request.id))messages.push({...request,role:'user',created_at:new Date().toISOString()});
   return respond({saved:true});
  }
  return respond({messages:window.fixture.empty?[]:messages,state:window.fixture.state,can_send:!window.fixture.blocked});
 }
 if(url.pathname.endsWith('/documents')){
  if(method==='POST'){
   if(window.fixture.failUpload)return respond({error:'Fictional upload failed. Try the same file again.'},503);
   const file=options.body.get('file'), id=options.body.get('id');window.fixture.uploads.push({id,name:file.name});
   documents.push({id,filename:file.name,state:'ready',extraction_state:'source_ready',extraction_result:null});return respond({id});
  }
  return respond(documents);
 }
 if(url.pathname.endsWith('/extraction')){
  const id=url.pathname.split('/').at(-2), doc=documents.find(document=>document.id===id);if(doc)doc.extraction_state='direct_running';return respond({started:true});
 }
 if(url.pathname.endsWith('/autonomy'))return respond({authorities:[{id:'fictional-authority',state:window.fixture.state==='stopped'?'revoked':'active',policy:{version:2}}],decisions:[],sessions:[{id:'fictional-run',authority_id:'fictional-authority',engine:'naive',state:window.fixture.state,goal:'Review the documented claim decision and gather the missing evidence.'}],activation_available:true});
 if(url.pathname.endsWith('/revoke')){window.fixture.state='stopped';return respond({stopped:true});}
 if(url.pathname.endsWith('/replies'))return respond({replies:[]});
 if(url.pathname.endsWith('/actions')||url.pathname.endsWith('/outcomes'))return respond([]);
 if(url.pathname.includes('gmail'))return respond({connected:false});
 return respond({});
};
const item={id:caseId,owner_id:owner,title:'A claim decision to sort out',case_type:'health_insurance',revision:1,status:'new',bill_cents:240000,eob_cents:65000,notes:'Fictional fixture only. No real claim or medical information.',intake:{injury_description:'A fictional claim decision needs review.',insurer_name:'Example Benefits',claim_number:'DEMO-1042',claim_stage:'denied'},created_at:now,updated_at:now};
createRoot(document.getElementById('root')).render(React.createElement(CaseView,{item,userId:owner,crewEnabled:true,busy:null,live:null,onSave:async()=>{},onAct:async()=>true}));
</script></body></html>`);
const server = await createServer({server: {host: "127.0.0.1", port: 4193, strictPort: true}});
await server.listen();
console.log(`Synthetic claim-page fixture: http://127.0.0.1:4193/${path}`);
async function close() { await server.close(); unlinkSync(path); process.exit(0); }
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
