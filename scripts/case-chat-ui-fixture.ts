import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const caseId=randomUUID(),owner='fictional-chat-owner',port=4187,path='test-results/case-chat-ui-fixture.html',base='https://fixture-cases.compute.example.com';
mkdirSync('test-results',{recursive:true});
writeFileSync(path,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="surface"><div id="root"></div></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {CaseChat} from '/src/CaseChat.tsx';import {CaseDocumentsProvider} from '/src/Documents.tsx';import {auth} from '/src/services.ts';import '/src/style.css';
auth.getSession=async()=>({data:{user:{id:'${owner}'},session:{token:'fictional-ui-token'}},error:null});
createRoot(document.getElementById('root')).render(React.createElement(CaseDocumentsProvider,{caseId:'${caseId}',userId:'${owner}',revision:1},React.createElement('section',{id:'section-conversation'},React.createElement(CaseChat,{caseId:'${caseId}',userId:'${owner}',revision:1}))));
</script></body></html>`);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',env:{...process.env,VITE_CASES_API_URL:base}}),browser=await chromium.launch();
try{
 const url=`http://127.0.0.1:${port}/${path}`;let ready=false;for(let n=0;n<50;n++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Fixture server did not start');
 const page=await browser.newPage();let state='human_required',failNext=false;
 const messages=[{id:randomUUID(),role:'assistant',text:'What date did the incident happen?',created_at:new Date().toISOString(),kind:'request_human'}],posts:any[]=[];
 await page.route(`${base}/cases/${caseId}/documents`,route=>route.fulfill({json:[]}));
 await page.route(`${base}/cases/${caseId}/messages`,async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();posts.push(body);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Temporary save failure. Retry the same message.'}});}
   if(!messages.some(m=>m.id===body.id))messages.push({...body,role:'user',created_at:new Date().toISOString(),kind:'owner_message'});
   return route.fulfill({json:{saved:true,resumed:state!=='stopped',message_id:body.id}});
  }
  return route.fulfill({json:{messages,state,can_send:true}});
 });
 await page.goto(url);await expect(page.getByRole('log')).toContainText('What date did the incident happen?');
 await page.getByRole('textbox',{name:'Message Assurance',exact:true}).fill('November 1.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('November 1.');await expect(page.getByRole('textbox',{name:'Message Assurance',exact:true})).toHaveValue('');expect(posts).toHaveLength(1);
 await page.reload();await expect(page.getByRole('log')).toContainText('November 1.');
 failNext=true;await page.getByRole('textbox',{name:'Message Assurance',exact:true}).fill('The location was the lab.');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Temporary save failure');await expect(page.getByRole('log')).not.toContainText('The location was the lab.');
 await page.getByRole('button',{name:'Retry message',exact:true}).click();await expect(page.getByRole('log')).toContainText('The location was the lab.');expect(posts[1]).toEqual(posts[2]);
 await expect(page.getByLabel('Document file')).toHaveCount(1);await expect(page.getByLabel('Document file')).toHaveAttribute('accept',/application\/pdf/);
 state='stopped';await page.getByRole('button',{name:'Refresh messages',exact:true}).click();await expect(page.getByText('Sending a message will not restart stopped agent work.',{exact:false})).toBeVisible();
 await page.getByRole('textbox',{name:'Message Assurance',exact:true}).fill('Keep this note for later.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByRole('log')).toContainText('Keep this note for later.');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/case-chat-mobile.png',fullPage:true});
 console.log('PASS website chat: saved messages survive reload; failed send is absent and retries same ID; one in-composer uploader; stopped-work notice; mobile width. No external communications.');
}finally{await browser.close();server.kill();unlinkSync(path);}
