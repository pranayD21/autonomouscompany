import {chromium} from '@playwright/test';import {spawn} from 'node:child_process';import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {checkAutonomyPermissions} from './autonomy-ui-check';
const caseId=randomUUID(),owner='synthetic-activation-ui',port=4183,path='test-results/activation-ui-fixture.html';
mkdirSync('test-results',{recursive:true});
writeFileSync(path,`<!doctype html><html><body><main><article data-case-id="${caseId}"><div id="root"></div></article></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {Autonomy} from '/src/Autonomy.tsx';import {auth} from '/src/services.ts';
auth.getSession=async()=>({data:{user:{id:'${owner}'},session:{token:'synthetic-ui-token'}},error:null});
window.fixtureApiBase=import.meta.env.VITE_CASES_API_URL;
createRoot(document.getElementById('root')).render(React.createElement(Autonomy,{caseId:'${caseId}',userId:'${owner}',enabled:false}));
</script></body></html>`);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'}),browser=await chromium.launch();
try{
 const url=`http://127.0.0.1:${port}/${path}`;let ready=false;
 for(let n=0;n<50;n++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Fixture dev server did not start');
 const page=await browser.newPage();
 // Block the component's first read before its exact mocked route is installed.
 await page.route(url=>url.hostname.includes('-cases.compute.'),route=>route.fulfill({json:{authorities:[],decisions:[],sessions:[],activation_available:false}}));
 await page.goto(url);await page.waitForFunction(()=>typeof (window as any).fixtureApiBase==='string');
 const base=await page.evaluate(()=>(window as any).fixtureApiBase as string);
 await checkAutonomyPermissions(page,base,caseId);
}finally{await browser.close();server.kill();unlinkSync(path);}
