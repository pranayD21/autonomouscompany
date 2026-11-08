import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
const port=4188,base=`http://127.0.0.1:${port}`,apiBase='https://fixture-cases.compute.example.com',path='test-results/email-entry-ui-fixture.html';
mkdirSync('test-results',{recursive:true});
writeFileSync(path,`<!doctype html><html><body><main><div id="root"></div></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {EmailSignIn} from '/src/EmailSignIn.tsx';import {EmailLeads} from '/src/EmailLeads.tsx';import {auth} from '/src/services.ts';import '/src/style.css';
window.emailCalls=[];auth.signIn={email:async data=>{window.emailCalls.push({kind:'signin',...data});sessionStorage.setItem('emailCalls',JSON.stringify(window.emailCalls));return data.password==='incorrect'?{error:{message:'Email or password is incorrect.'}}:{error:null};}};
auth.signUp={email:async data=>{window.emailCalls.push({kind:'signup',...data});sessionStorage.setItem('emailCalls',JSON.stringify(window.emailCalls));return {error:null};}};
auth.getSession=async()=>({data:{user:{id:'fixture-owner',email:'owner@example.com'},session:{token:'fixture'}},error:null});
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,new URLSearchParams(location.search).has('leads')?React.createElement(EmailLeads,{userId:'fixture-owner',onOpen:id=>{document.body.dataset.opened=id;}}):React.createElement(EmailSignIn)));
</script></body></html>`);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',env:{...process.env,VITE_CASES_API_URL:apiBase}}),browser=await chromium.launch();
try{
 let ready=false;for(let n=0;n<50;n++){try{if((await fetch(`${base}/${path}`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Fixture server did not start');
 const page=await browser.newPage();let external=0;
 await page.route(url=>url.origin!==base,route=>{external++;if(route.request().url()===`${apiBase}/firm/contact`)return route.fulfill({json:{email:'assurance-fixture@example.com'}});return route.fulfill({body:'',status:404});});
 await page.route(`${base}/`,route=>route.fulfill({contentType:'text/html',body:'<h1>Signed in fixture</h1>'}));
 await page.goto(`${base}/${path}`);await expect(page.getByLabel('Email',{exact:true})).toBeVisible();await expect(page.getByLabel('Phone number',{exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'assurance-fixture@example.com'})).toHaveAttribute('href','mailto:assurance-fixture@example.com');
 await page.evaluate(()=>localStorage.setItem('assurance-auth-mode','phone'));
 await page.getByLabel('Email',{exact:true}).fill('owner@example.com');await page.getByLabel('Password',{exact:true}).fill('incorrect');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');expect(await page.evaluate(()=>localStorage.getItem('assurance-auth-mode'))).toBe('phone');
 await page.getByLabel('Password',{exact:true}).fill('fixture-passphrase');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Signed in fixture'})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('assurance-auth-mode'))).toBeNull();
 await page.goto(`${base}/${path}`);await page.getByRole('button',{name:'New here? Create an account'}).click();await page.getByLabel('Name',{exact:true}).fill('Fictional owner');await page.getByLabel('Email',{exact:true}).fill('new-owner@example.com');await page.getByLabel('Password',{exact:true}).fill('fixture-passphrase');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('heading',{name:'Signed in fixture'})).toBeVisible();const calls=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('emailCalls')??'[]'));expect(calls[0]).toMatchObject({kind:'signup',email:'new-owner@example.com',name:'Fictional owner'});
 let claims=0;
 await page.route(`${apiBase}/email/leads`,route=>route.fulfill({json:{email_verified:true,leads:[{id:'lead-fixture',subject:'Workplace incident',case_id:null}]}}));
 await page.route(`${apiBase}/email/leads/lead-fixture/claim`,route=>{expect(route.request().postDataJSON()).toEqual({case_type:'workplace_injury'});claims++;return route.fulfill({json:{id:'case-fixture'}});});
 await page.goto(`${base}/${path}?leads=1`);await expect(page.getByRole('heading',{name:'Your emails to Assurance'})).toBeVisible();await expect(page.getByRole('button',{name:'Open case'})).toBeDisabled();await page.getByLabel('What is this about?').selectOption('workplace_injury');await page.getByRole('button',{name:'Open case'}).click();await expect(page.locator('body')).toHaveAttribute('data-opened','case-fixture');expect(claims).toBe(1);
 await page.route(`${apiBase}/email/leads`,route=>route.fulfill({json:{email_verified:false,leads:[]}}));await page.goto(`${base}/${path}?leads=1`);await expect(page.getByRole('button',{name:'Verify my email'})).toBeVisible();await expect(page.getByRole('heading',{name:'Your emails to Assurance'})).toHaveCount(0);
 let confirmations=0;
 await page.route(`${apiBase}/email/verify/confirm`,async route=>{confirmations++;expect(route.request().postDataJSON()).toEqual({token:'fixture-token'});await new Promise(r=>setTimeout(r,80));return route.fulfill({json:{verified:true}});});
 await page.route(`${apiBase}/email/leads`,route=>route.fulfill({json:{email_verified:confirmations>0,leads:[]}}));
 await page.goto(`${base}/${path}?leads=1&verify_email=fixture-token`);await expect.poll(()=>confirmations).toBe(1);await expect(page.getByRole('button',{name:'Verify my email'})).toHaveCount(0);expect(new URL(page.url()).searchParams.has('verify_email')).toBe(false);
 expect(external).toBeGreaterThan(0);console.log('PASS email-first form, configured AgentMail contact, invalid credentials, account creation, and clearing legacy phone selection only after successful email login. No messages or real accounts created.');
}finally{await browser.close();server.kill();unlinkSync(path);}
