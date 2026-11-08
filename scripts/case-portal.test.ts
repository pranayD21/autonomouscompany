import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalOrigin,portalActionInput} from '../backend/case-portal';
test('portal origin rejects local, IP, credential and non-TLS destinations',()=>{for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://[::1]','https://user:secret@example.com','https://portal.internal'])assert.throws(()=>portalOrigin(url));assert.equal(portalOrigin('https://claims.example.com/start'),'https://claims.example.com');});
test('native portal schema only accepts documented limited browser actions',()=>{assert.equal(portalActionInput.safeParse({operation_id:'b9344bca-774d-4afd-9362-72732a5df4b6',action:{action:'type',selector:'#claim',text:'Fictional'}}).success,true);for(const action of ['exec','upload','login','act'])assert.equal(portalActionInput.safeParse({operation_id:'b9344bca-774d-4afd-9362-72732a5df4b6',action:{action}}).success,false);});
