import {test} from 'node:test';import assert from 'node:assert/strict';import {boardAssignee} from '../backend/firm-service';
test('board role aliases and IDs resolve to provider agent names',async()=>{
 const calls:string[]=[];const request=async(method:string,path:string)=>{assert.equal(method,'GET');calls.push(path);return {name:'assurance-frontdesk'};};
 assert.equal(await boardAssignee('frontdesk',{frontdesk:{agent_id:'agt_fixture',identity_id:'idn_fixture'}},request),'assurance-frontdesk');
 assert.equal(await boardAssignee('agt_fixture',{},request),'assurance-frontdesk');assert.equal(await boardAssignee('assurance-reviewer',{},request),'assurance-reviewer');assert.equal(calls.length,2);
 await assert.rejects(boardAssignee('frontdesk',{frontdesk:{agent_id:'agt_fixture',identity_id:'idn_fixture'}},async()=>({name:''})));
});
