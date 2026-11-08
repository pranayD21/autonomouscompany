import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fictionalClaimPortal} from './fixtures/fictional-claim-portal';
test('fictional portal accepts a form once per reference and returns labeled confirmation',async()=>{const app=fictionalClaimPortal();assert.match(await (await app.request('/')).text(),/id="submit"/);const send=()=>app.request('/submit',{method:'POST',body:new URLSearchParams({reference:'fixture-1',account:'Fictional workplace incident'})});const first=await (await send()).text(),second=await (await send()).text();assert.equal(first,second);assert.match(first,/FICTIONAL-/);assert.match(first,/No insurer received/);});
