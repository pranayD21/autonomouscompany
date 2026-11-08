import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
const port=4191,base=`http://127.0.0.1:${port}`,apiBase='https://fixture-cases.compute.example.com',path='test-results/phone-onboarding-ui-fixture.html';
mkdirSync('test-results',{recursive:true});
writeFileSync(path,`<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {OnboardingCallNotice} from '/src/phone-onboarding.tsx';import {auth} from '/src/services.ts';import '/src/style.css';
auth.getSession=async()=>({data:{user:{id:'phone:fixture-owner'},session:{token:'fixture'}},error:null});
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(OnboardingCallNotice,{userId:'phone:fixture-owner'})));
</script></body></html>`);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',env:{...process.env,VITE_CASES_API_URL:apiBase}}),browser=await chromium.launch();
try{
 let ready=false;for(let n=0;n<50;n++){try{if((await fetch(`${base}/${path}`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Fixture server did not start');
 const page=await browser.newPage();let state='submitted',stops=0,failStop=false;
 // No external network request leaves this fixture.
 await page.route(url=>url.origin!==base,async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===apiBase&&url.pathname==='/phone/onboarding'&&request.method()==='GET')return route.fulfill({json:{status:state,case_id:state==='active'?'case-fixture':null}});
  if(url.origin===apiBase&&url.pathname==='/phone/onboarding/stop'){
   stops++;expect(request.method()).toBe('POST');expect(request.headers().authorization).toBe('Bearer fixture');expect(request.postDataJSON()).toEqual({});
   await new Promise(resolve=>setTimeout(resolve,150));
   if(failStop)return route.fulfill({status:503,json:{error:'Temporary service failure.'}});
   state='cancelled';return route.fulfill({json:{status:state,reason:'You stopped onboarding and case work. An already requested call may still connect; no further case work will start.'}});
  }
  return route.fulfill({status:404,body:''});
 });
 await page.goto(`${base}/${path}`);const stop=page.getByRole('button',{name:'Stop onboarding and case work',exact:true});await expect(stop).toBeVisible();await stop.click();await expect(page.getByRole('button',{name:'Stopping onboarding…'})).toBeDisabled();await expect(page.getByRole('status')).toContainText('Onboarding and case work are stopped');await expect(page.getByRole('status')).toContainText('may still connect');await expect(stop).toHaveCount(0);expect(stops).toBe(1);
 await page.reload();await expect(page.getByRole('status')).toContainText('Onboarding and case work are stopped');expect(stops).toBe(1);
 state='active';failStop=true;await page.reload();await expect(page.getByRole('link',{name:'Open your case'})).toHaveAttribute('href','#case/case-fixture');await stop.click();await expect(page.getByRole('alert')).toContainText('couldn’t confirm');await expect(page.getByRole('status')).toContainText('Your case is ready');await expect(stop).toBeEnabled();
 failStop=false;await stop.click();await expect(page.getByRole('status')).toContainText('Onboarding and case work are stopped');expect(stops).toBe(3);
 console.log('PASS onboarding stop: authenticated POST, disabled pending action, confirmed cancellation, truthful in-flight call caveat, reload persistence, existing-case control, and failed-stop recovery. No calls or external messages.');
}finally{await browser.close();server.kill();unlinkSync(path);}
