import {chromium,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
const base=process.env.PHONE_UI_BASE_URL??'http://127.0.0.1:4184';
const server=process.env.PHONE_UI_BASE_URL?null:spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'ignore'});
const browser=await chromium.launch();const numbers=['+15555550100','+15555550101'];
async function fixture(page:Page,enabled=true,smsReady=true){
 let sends=0,verified=0;const id=randomUUID();
 // All external requests are mocked: this suite never sends SMS or accesses a real account.
 await page.route(url=>url.origin!==new URL(base).origin,async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')return route.fulfill({body:'',contentType:'text/css'});
  if(url.hostname.includes('-phone.compute.')){
   if(path==='/status')return route.fulfill({json:{enabled,smsReady,testNumbers:enabled?numbers:[],testCode:enabled?'123456':null}});
   if(path==='/auth/phone-number/send-otp'){sends++;expect(route.request().postDataJSON().phoneNumber).toMatch(/^\+1555555010[01]$/);return route.fulfill({json:{message:'Code sent'}});}
   if(path==='/auth/phone-number/verify'){const body=route.request().postDataJSON();if(body.code!=='123456')return route.fulfill({status:400,json:{message:'Invalid code. Please try again.'}});verified++;return route.fulfill({json:{token:'synthetic-session-token',user:{id,phoneNumber:body.phoneNumber,phoneNumberVerified:true}}});}
   if(path==='/auth/get-session')return route.fulfill({json:{session:{token:'synthetic-session-token'},user:{id,name:'Synthetic caller',phoneNumberVerified:true}}});
   if(path==='/auth/token')return route.fulfill({json:{token:'synthetic-jwt-fixture'}});
  }
  if(url.hostname.includes('-cases.compute.')&&path==='/cases/live'){expect(route.request().headers().authorization).toBe('Bearer synthetic-jwt-fixture');return route.fulfill({status:403,json:{error:'Phone session fixture reached the protected dashboard API.'}});}
  if(path.endsWith('/get-session'))return route.fulfill({json:null});
  throw Error(`Unexpected external fixture request ${url.origin}${path}`);
 });
 return {counts:()=>({sends,verified})};
}
try{
 let ready=false;for(let n=0;n<50;n++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Phone UI server did not start');
 const page=await browser.newPage(),manual=await fixture(page);
 await page.goto(`${base}/#workspace`);const section=page.getByRole('region',{name:'Phone sign-in'});await expect(section).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Have an older email account? Sign in with email',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Use phone sign-in',exact:true}).click();
 await section.getByLabel('Phone number',{exact:true}).fill('(555) 555-0100');await section.getByRole('button',{name:'Text me a sign-in code',exact:true}).click();await expect(section.getByLabel('Phone number',{exact:true})).toHaveValue('+15555550100');
 await section.getByLabel('Verification code',{exact:true}).fill('000000');await section.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(section.getByRole('alert')).toContainText('Invalid code');
 await section.getByLabel('Verification code',{exact:true}).fill('123456');await section.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(page.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible({timeout:15000});expect(manual.counts()).toEqual({sends:1,verified:1});await page.close();
 const demo=await browser.newPage(),quick=await fixture(demo,true,false);await demo.goto(`${base}/#workspace`);await expect(demo.getByText('Live SMS is not available yet. Only the fictional test numbers below work right now.',{exact:true})).toBeVisible();await expect(demo.getByLabel('Email',{exact:true})).toHaveCount(0);await demo.getByRole('button',{name:numbers[1],exact:true}).click();await expect(demo.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible({timeout:15000});expect(quick.counts()).toEqual({sends:1,verified:1});await demo.close();
 const unavailable=await browser.newPage(),disabled=await fixture(unavailable,false,false);await unavailable.goto(`${base}/#workspace`);await expect(unavailable.getByLabel('Email',{exact:true})).toBeVisible();await expect(unavailable.getByRole('region',{name:'Phone sign-in'})).toHaveCount(0);expect(disabled.counts()).toEqual({sends:0,verified:0});await unavailable.close();
 console.log('PASS mocked phone-only sign-in, email fallback, US normalization, invalid-code recovery, one-tap demo account with SMS unavailable, and scoped dashboard bearer token. No texts sent.');
}finally{await browser.close();server?.kill();}
