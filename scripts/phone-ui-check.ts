import {chromium,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
const base=process.env.PHONE_UI_BASE_URL??'http://127.0.0.1:4184';
const server=process.env.PHONE_UI_BASE_URL?null:spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'ignore',env:{...process.env,VITE_CASES_API_URL:'https://fixture-cases.compute.example.com',VITE_NEON_AUTH_URL:'https://fixture-auth.example.com',VITE_NEON_REALTIME_URL:'https://fixture-realtime.example.com'}});
const browser=await chromium.launch();
async function fixture(page:Page,{enabled=true,callFails=false,onboardingEnabled=true,smsReady=enabled,testNumbers=[]}:{enabled?:boolean;callFails?:boolean;onboardingEnabled?:boolean|null;smsReady?:boolean;testNumbers?:string[]}={}){
 let sends=0,verified=0,calls=0,jwts=0;const id=randomUUID();
 // Every external request is mocked. This suite cannot send a real SMS or call.
 await page.route(url=>url.origin!==new URL(base).origin,async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')return route.fulfill({body:'',contentType:'text/css'});
  if(url.hostname.includes('-phone.compute.')){
   if(path==='/status')return route.fulfill({json:{enabled,smsReady,...(onboardingEnabled===null?{}:{onboardingEnabled}),testNumbers,testCode:testNumbers.length?'123456':null}});
   if(path==='/auth/phone-number/send-otp'){sends++;expect(route.request().postDataJSON().phoneNumber).toMatch(/^\+1[2-9]\d{9}$/);return route.fulfill({json:{message:'Code sent'}});}
   if(path==='/auth/phone-number/verify'){
    const body=route.request().postDataJSON();if(body.code!=='123456')return route.fulfill({status:400,json:{message:'Invalid code. Please try again.'}});
    verified++;return route.fulfill({json:{token:'synthetic-session-token',user:{id,phoneNumber:body.phoneNumber,phoneNumberVerified:true}}});
   }
   if(path==='/auth/get-session')return route.fulfill({json:{session:{token:'synthetic-session-token'},user:{id,name:'Synthetic caller',phoneNumber:'+14155551234',phoneNumberVerified:true}}});
   if(path==='/auth/token'){jwts++;return route.fulfill({json:{token:'synthetic-jwt-fixture'}});}
  }
  if(url.hostname.includes('-cases.compute.')){
   if(path==='/phone/onboarding'){
    if(route.request().method()==='POST'){
     calls++;expect(route.request().headers().authorization).toBe('Bearer synthetic-jwt-fixture');
     expect(route.request().postDataJSON()).toEqual({request_call:true,accept_standard_handling:true});
     return route.fulfill(callFails?{status:503,json:{error:'Voice service unavailable'}}:{json:{status:'submitted'}});
    }
    return route.fulfill({json:{enabled,status:calls?'submitted':'not_started',phone:'+14155551234'}});
   }
   if(path==='/cases/live'){expect(route.request().headers().authorization).toBe('Bearer synthetic-jwt-fixture');return route.fulfill({status:403,json:{error:'Phone session fixture reached the protected dashboard API.'}});}
   if(path==='/firm/contact')return route.fulfill({json:{email:null}});
  }
  if(path.endsWith('/get-session'))return route.fulfill({json:null});
  return route.fulfill({status:404,json:{error:`Unexpected fixture request ${path}`}});
 });
 return {counts:()=>({sends,verified,calls,jwts})};
}
async function verify(page:Page){
 const section=page.getByRole('region',{name:'Phone sign-in'});
 await section.getByLabel('Phone number',{exact:true}).fill('(415) 555-1234');
 await section.getByRole('button',{name:'Verify and call me',exact:true}).click();
 await expect(section.getByLabel('Phone number',{exact:true})).toHaveValue('+14155551234');
 await section.getByLabel('Verification code',{exact:true}).fill('123456');
 await section.getByRole('button',{name:'Verify and call me',exact:true}).click();
 await expect(page.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible({timeout:15000});
}
try{
 let ready=false;for(let n=0;n<50;n++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Phone UI server did not start');
 const page=await browser.newPage({reducedMotion:'reduce'}),manual=await fixture(page);
 await page.goto(base);const section=page.getByRole('region',{name:'Phone sign-in'});await expect(section).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
 await expect(section).toContainText('submit claim forms and evidence');
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/phone-entry-mobile.png',fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/phone-entry-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Have an older email account? Sign in with email',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Use phone sign-in',exact:true}).click();
 await section.getByLabel('Phone number',{exact:true}).fill('(415) 555-1234');await section.getByRole('button',{name:'Verify and call me',exact:true}).click();
 await section.getByLabel('Verification code',{exact:true}).fill('000000');await section.getByRole('button',{name:'Verify and call me',exact:true}).click();await expect(section.getByRole('alert')).toContainText('Invalid code');expect(manual.counts()).toMatchObject({calls:0,verified:0});
 await section.getByLabel('Verification code',{exact:true}).fill('123456');await section.getByRole('button',{name:'Verify and call me',exact:true}).dblclick();await expect(page.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible({timeout:15000});
 await expect.poll(()=>manual.counts().calls).toBe(1);expect(manual.counts()).toMatchObject({sends:1,verified:1,calls:1});
 await page.reload();await expect(page.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible();expect(manual.counts()).toMatchObject({sends:1,verified:1,calls:1});await page.close();
 const failure=await browser.newPage(),failed=await fixture(failure,{callFails:true});await failure.goto(`${base}/#workspace`);await verify(failure);await expect.poll(()=>failed.counts().calls).toBe(1);expect(await failure.evaluate(()=>sessionStorage.getItem('assurance-phone-session'))).toBe('synthetic-session-token');await failure.reload();await expect(failure.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible();expect(failed.counts().calls).toBe(1);await failure.close();
 const unavailable=await browser.newPage(),disabled=await fixture(unavailable,{enabled:false});await unavailable.goto(`${base}/#workspace`);await expect(unavailable.getByRole('region',{name:'Phone sign-in'}).getByRole('button').first()).toBeDisabled();await unavailable.getByRole('button',{name:'Have an older email account? Sign in with email',exact:true}).click();await expect(unavailable.getByLabel('Email',{exact:true})).toBeVisible();expect(disabled.counts()).toMatchObject({sends:0,verified:0,calls:0});await unavailable.close();
 for(const onboardingEnabled of [false,null]){
  const login=await browser.newPage(),counts=await fixture(login,{onboardingEnabled});await login.goto(`${base}/#workspace`);
  await expect(login.getByText('Onboarding calls are unavailable right now. You can still sign in with your phone and use your dashboard.')).toBeVisible();await expect(login.getByRole('button',{name:'Verify and call me',exact:true})).toHaveCount(0);await expect(login.getByLabel('Email',{exact:true})).toHaveCount(0);
  await login.getByLabel('Phone number',{exact:true}).fill('(415) 555-1234');await login.getByRole('button',{name:'Text me a sign-in code',exact:true}).click();await login.getByLabel('Verification code',{exact:true}).fill('123456');await login.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(login.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible();expect(counts.counts()).toMatchObject({sends:1,verified:1,calls:0});await login.close();
 }
 const fictional=await browser.newPage(),fictionalCounts=await fixture(fictional,{testNumbers:['+14155550100']});await fictional.goto(`${base}/#workspace`);await fictional.getByRole('button',{name:'+14155550100',exact:true}).click();await expect(fictional.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible();expect(fictionalCounts.counts()).toMatchObject({sends:1,verified:1,calls:0});await fictional.close();
 const typed=await browser.newPage(),typedCounts=await fixture(typed,{testNumbers:['+14155550100']});await typed.goto(`${base}/#workspace`);await typed.getByLabel('Phone number',{exact:true}).fill('(415) 555-0100');await expect(typed.getByRole('button',{name:'Verify and call me',exact:true})).toHaveCount(0);await typed.getByRole('button',{name:'Text me a sign-in code',exact:true}).click();await typed.getByLabel('Verification code',{exact:true}).fill('123456');await typed.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(typed.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible();expect(typedCounts.counts()).toMatchObject({sends:1,verified:1,calls:0});await typed.close();
 console.log('PASS phone-first landing, explicit call/handling scope, older email fallback, normalization, invalid OTP, one onboarding request, retained session after reload/provider failure, disabled readiness, login without missing/false call readiness, and fictional accounts never requesting calls. No real texts, calls, or accounts.');
}finally{await browser.close();server?.kill();}
