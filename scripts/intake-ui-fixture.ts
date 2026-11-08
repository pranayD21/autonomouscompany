import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
const port=4184,path='test-results/intake-ui-fixture.html';
mkdirSync('test-results',{recursive:true});
writeFileSync(path,`<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {CaseForm} from '/src/CaseForm.tsx';
window.submissions=[];createRoot(document.getElementById('root')).render(React.createElement(CaseForm,{onSave:async(data,files)=>{window.submissions.push({data,files:files.map(f=>({name:f.name,size:f.size}))});}}));
</script></body></html>`);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'}),browser=await chromium.launch();
try{
 const url=`http://127.0.0.1:${port}/${path}`;let ready=false;
 for(let n=0;n<50;n++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Fixture not ready');
 const page=await browser.newPage();await page.goto(url);
 await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByLabel('Contact name',{exact:true})).not.toBeVisible();
 await page.getByLabel('What happened?',{exact:true}).fill('I need help with a chemical burn claim at work.');
 await page.getByRole('button',{name:'Start handling my case',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).submissions.length)).toBe(1);
 const first=await page.evaluate(()=>(window as any).submissions[0]);expect(first.data.intake.contact_name).toBe('');expect(first.data.intake.injury_description).toContain('chemical burn');expect(first.data.title).toContain('chemical burn');expect(first.files).toEqual([]);
 await page.reload();await page.getByLabel('Attach documents',{exact:false}).setInputFiles({name:'incident.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF fictional fixture')});
 await page.getByRole('button',{name:'Start handling my case',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).submissions.length)).toBe(1);
 const second=await page.evaluate(()=>(window as any).submissions[0]);expect(second.data.intake.injury_description).toBe('Please review my attached documents: incident.pdf');expect(second.files[0].name).toBe('incident.pdf');
 console.log('PASS mocked intake form: narrative-only and document-only submission, optional contact fields, derived title, and no permission checkbox. No API or outbound actions.');
}finally{await browser.close();server.kill();unlinkSync(path);}
