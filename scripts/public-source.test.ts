import {test} from "node:test";
import assert from "node:assert/strict";
import {sourceUrl,publicAddress,fetchPublicSource,type SourceTransport} from "../backend/public-source";
const quote="This is a public source with an exact short quote.";
const good:SourceTransport={resolve:async()=>[{address:"93.184.215.14",family:4}],read:async()=>({status:200,mime:"text/html",bytes:Buffer.from(`<html><title>Evidence</title><main><p>${quote}</p></main></html>`)})};
test("private, mapped, reserved, metadata, and local URL destinations reject",()=>{
 for(const ip of ["127.0.0.1","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","0.0.0.0","224.0.0.1","::1","fc00::1","fe80::1","::ffff:127.0.0.1","2001:db8::1"])assert.equal(publicAddress(ip),false,ip);
 for(const url of ["http://example.com","https://user:secret@example.com","https://localhost./","https://foo.internal/","https://127.1/","https://2130706433/","https://[::ffff:127.0.0.1]/","https://example.com:8443/"])assert.throws(()=>sourceUrl(url),url);
 assert.equal(publicAddress("8.8.8.8"),true);assert.equal(publicAddress("2606:4700:4700::1111"),true);
});
test("all DNS answers are validated and the chosen public address is passed to transport",async()=>{
 let reads=0;await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{...good,resolve:async()=>[{address:"8.8.8.8",family:4},{address:"127.0.0.1",family:4}],read:async(...args)=>{reads++;return good.read(...args);}}),/ADDRESS_REJECTED/);assert.equal(reads,0);
 const result=await fetchPublicSource("https://example.com",quote,{...good,read:async(url,address,signal)=>{assert.equal(address.address,"93.184.215.14");return good.read(url,address,signal);}});assert.equal(result.quote,quote);assert.equal(result.sha256.length,64);
});
test("redirects revalidate DNS and reject private destinations and loops",async()=>{
 await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{...good,read:async()=>({status:302,location:"https://169.254.169.254/",mime:"",bytes:Buffer.alloc(0)})}),/ADDRESS_REJECTED/);
 let resolves=0;await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{resolve:async()=>[{address:++resolves===1?"8.8.8.8":"10.0.0.1",family:4}],read:async()=>({status:302,location:"https://second.example.com/",mime:"",bytes:Buffer.alloc(0)})}),/ADDRESS_REJECTED/);assert.equal(resolves,2);
 await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{...good,read:async()=>({status:302,location:"https://example.com",mime:"",bytes:Buffer.alloc(0)})}),/LOOP/);
});
test("quotes must exist and fit the quotation limit; types and bodies are bounded",async()=>{
 await assert.rejects(()=>fetchPublicSource("https://example.com","An invented quotation that is not present.",good),/QUOTE_NOT_FOUND/);
 await assert.rejects(()=>fetchPublicSource("https://example.com","word ".repeat(26),good),/QUOTE_SIZE/);
 await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{...good,read:async()=>({status:200,mime:"application/octet-stream",bytes:Buffer.from(quote)})}),/TYPE_UNSUPPORTED/);
 await assert.rejects(()=>fetchPublicSource("https://example.com",quote,{...good,read:async()=>({status:200,mime:"text/plain",bytes:Buffer.alloc(2097153)})}),/TOO_LARGE/);
});

test("PDF text-layer quotes are verified without inferring image content",async()=>{
 const {chromium}=await import("@playwright/test");const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.setContent(`<p>${quote}</p>`);const pdf=await page.pdf();
  const source=await fetchPublicSource("https://example.com/source.pdf",quote,{...good,read:async()=>({status:200,mime:"application/pdf",bytes:pdf})});assert.equal(source.quote,quote);
  await page.setContent('<div style="background:black;width:100px;height:100px"></div>');const imageOnly=await page.pdf();
  await assert.rejects(()=>fetchPublicSource("https://example.com/scan.pdf",quote,{...good,read:async()=>({status:200,mime:"application/pdf",bytes:imageOnly})}),/PDF_NO_TEXT/);
 }finally{await browser.close();}
});
