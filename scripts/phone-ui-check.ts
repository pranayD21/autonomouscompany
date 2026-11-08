import {chromium,expect} from '@playwright/test';import {randomUUID} from 'node:crypto';
const browser=await chromium.launch(),page=await browser.newPage();let sends=0,verified=0;const id=randomUUID();
try{
 await page.route(url=>url.hostname.includes('-phone.compute.'),async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/status')return route.fulfill({json:{enabled:true,smsReady:true}});
  if(path==='/auth/phone-number/send-otp'){sends++;expect(route.request().postDataJSON()).toEqual({phoneNumber:'+15555550123'});return route.fulfill({json:{message:'Code sent'}});}
  if(path==='/auth/phone-number/verify'){const body=route.request().postDataJSON();if(body.code!=='123456')return route.fulfill({status:400,json:{message:'Invalid code. Please try again.'}});verified++;return route.fulfill({json:{token:'synthetic-session-token',user:{id,phoneNumber:'+15555550123',phoneNumberVerified:true}}});}
  if(path==='/auth/get-session')return route.fulfill({json:{session:{token:'synthetic-session-token'},user:{id,name:'Synthetic caller',phoneNumberVerified:true}}});
  if(path==='/auth/token')return route.fulfill({json:{token:'synthetic-jwt-fixture'}});
  throw Error(`Unexpected phone route ${path}`);
 });
 await page.route(url=>url.hostname.includes('-cases.compute.')&&url.pathname==='/cases/live',async route=>{expect(route.request().headers().authorization).toBe('Bearer synthetic-jwt-fixture');return route.fulfill({status:403,json:{error:'Phone session fixture reached the protected dashboard API.'}});});
 await page.goto('http://localhost:4173/#workspace');const section=page.getByRole('region',{name:'Phone sign-in'});await expect(section).toBeVisible();
 await section.getByLabel('Phone number',{exact:true}).fill('+15555550123');
 await page.screenshot({path:'test-results/phone-opt-in.png',fullPage:true});
 await section.getByRole('button',{name:'Text me a sign-in code',exact:true}).click();await section.getByLabel('Verification code',{exact:true}).fill('000000');await section.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(section.getByRole('alert')).toContainText('Invalid code');
 await section.getByLabel('Verification code',{exact:true}).fill('123456');await section.getByRole('button',{name:'Verify and open dashboard',exact:true}).click();await expect(page.getByText('Phone session fixture reached the protected dashboard API.',{exact:true})).toBeVisible({timeout:15000});expect(sends).toBe(1);expect(verified).toBe(1);console.log('PASS phone UI: OTP request, invalid-code recovery, verified session, and scoped dashboard token (mocked SMS/auth; no texts sent).');
}finally{await browser.close();}
