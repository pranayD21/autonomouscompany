import {chromium,expect} from "@playwright/test";
import {randomUUID,createHash} from "node:crypto";
import {config} from "dotenv";
config({path:".env.local",quiet:true});
const browser=await chromium.launch({headless:true});
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
try{
 const context=await browser.newContext({storageState:"test-results/crew-app-browser.json"});const page=await context.newPage();let authorization="",base="";
 page.on("request",r=>{if(r.url().endsWith("/stack/status")){authorization=r.headers().authorization;base=new URL(r.url()).origin;}});
 await page.goto("http://localhost:4173");await expect(page.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 const headers={Authorization:authorization,"Content-Type":"application/json"};
 const title=`Synthetic document check ${randomUUID()}`;
 const created=await fetch(`${base}/cases`,{method:"POST",headers,body:JSON.stringify({title,case_type:"health_insurance",bill_cents:null,eob_cents:null,notes:"Synthetic file verification only"})});expect(created.status).toBe(201);const caseId=(await created.json()).id;
 const card=page.locator("article").filter({hasText:title});await expect(card).toBeVisible({timeout:20000});
 await card.getByLabel("Document file",{exact:true}).setInputFiles({name:"synthetic-card.png",mimeType:"image/png",buffer:png});
 await card.getByRole("button",{name:"Save document",exact:true}).click();await expect(card.getByRole("button",{name:"Download synthetic-card.png",exact:true})).toBeVisible({timeout:30000});
 const path=`${base}/cases/${caseId}/documents`;
 const list=await(await fetch(path,{headers})).json();expect(list.length).toBe(1);const doc=list[0];expect(doc.object_key).toBeUndefined();expect(doc.sha256).toBe(createHash("sha256").update(png).digest("hex"));
 const download=await fetch(`${path}/${doc.id}/download`,{headers});expect(download.status).toBe(200);expect(download.headers.get("content-disposition")).toContain("attachment");expect(Buffer.from(await download.arrayBuffer()).equals(png)).toBe(true);
 const revision=async()=>{const all=await(await fetch(`${base}/cases`,{headers})).json();return all.find((c:any)=>c.id===caseId).revision;};expect(await revision()).toBe(2);
 const form=(bytes:Buffer,id=doc.id)=>{const data=new FormData();data.set("id",id);data.set("kind","insurance_card");data.set("file",new Blob([new Uint8Array(bytes)],{type:"image/png"}),"synthetic-card.png");return data;};
 const retries=await Promise.all([1,2].map(()=>fetch(path,{method:"POST",headers:{Authorization:authorization},body:form(png)})));expect(retries.every(r=>r.ok)).toBe(true);expect(await revision()).toBe(2);
 const conflict=await fetch(path,{method:"POST",headers:{Authorization:authorization},body:form(Buffer.concat([png,Buffer.from([1])]))});expect(conflict.status).toBe(409);
 const invalid=await fetch(path,{method:"POST",headers:{Authorization:authorization},body:form(Buffer.from("<script>bad</script>"),randomUUID())});expect(invalid.status).toBe(400);
 const anonymous=await fetch(path);expect(anonymous.status).toBe(401);
 const privateObject=await fetch(`${process.env.AWS_ENDPOINT_URL_S3}/case-documents/cases/${caseId}/${doc.id}`);expect([401,403]).toContain(privateObject.status);
 console.log("PASS UI upload, authenticated byte-for-byte download, SHA-256, private bucket, invalid format, immutable/concurrent retries, and one revision increment");
 await page.reload();await expect(card.getByRole("button",{name:"Download synthetic-card.png",exact:true})).toBeVisible({timeout:20000});
 const deletion=await fetch(`${base}/cases/${caseId}`,{method:"DELETE",headers});expect(deletion.status).toBe(409);
 const otherContext=await browser.newContext();const other=await otherContext.newPage();let otherAuth="";other.on("request",r=>{if(r.url().endsWith("/stack/status"))otherAuth=r.headers().authorization;});
 await other.goto("http://localhost:4173");await other.getByRole("button",{name:"New here? Create an account"}).click();await other.getByLabel("Name",{exact:true}).fill("Synthetic document isolation");await other.getByLabel("Email",{exact:true}).fill(`docs-${randomUUID()}@example.com`);await other.getByLabel("Password",{exact:true}).fill(randomUUID()+"aA1!");await other.getByRole("button",{name:"Create account",exact:true}).click();await expect(other.getByText("Live updates connected",{exact:true})).toBeVisible({timeout:45000});
 for(const [method,url]of [["GET",path],["POST",path],["GET",`${path}/${doc.id}/download`]]){const response=await fetch(url,{method,headers:{Authorization:otherAuth}});expect(response.status).toBe(404);}
 console.log("PASS persisted document listing, retained-case deletion guard, and second-user list/upload/download isolation");
}finally{await browser.close();}
