import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
test('reply reader excludes history, other recipients, outbound, other service and groups; holds unreadable replies',()=>{
 const dir=mkdtempSync(join(tmpdir(),'assurance-replies-')),db=join(dir,'chat.db');try{
 execFileSync('/usr/bin/python3',['-c',`
import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
c.executescript('''CREATE TABLE message(guid TEXT,text TEXT,date INTEGER,handle_id INTEGER,is_from_me INTEGER,service TEXT,associated_message_type INTEGER); CREATE TABLE handle(id TEXT); CREATE TABLE chat(guid TEXT); CREATE TABLE chat_message_join(message_id INTEGER,chat_id INTEGER); CREATE TABLE chat_handle_join(chat_id INTEGER,handle_id INTEGER); INSERT INTO handle VALUES('+14155550123'),('+14155550124'); INSERT INTO chat VALUES('SMS;-;+14155550123'),('group'); INSERT INTO chat_handle_join VALUES(1,1),(2,1),(2,2);''')
for i,(text,handle,outbound,service,chat) in enumerate([('old',1,0,'SMS',1),('right',1,0,'SMS',1),('other recipient',2,0,'SMS',1),('outbound',1,1,'SMS',1),('other service',1,0,'iMessage',1),('group message',1,0,'SMS',2),(None,1,0,'SMS',1),('after unreadable',1,0,'SMS',1)]):
 c.execute('INSERT INTO message VALUES(?,?,?,?,?,?,0)',(str(i+1),text,800000000000000000,handle,outbound,service));c.execute('INSERT INTO chat_message_join VALUES(?,?)',(i+1,chat))
c.commit();c.close()
`,db]);
 const run=(mode:unknown)=>JSON.parse(execFileSync('/usr/bin/python3',[resolve('scripts/mac-messages/read-replies.py')],{env:{...process.env,MAC_MESSAGES_DB_PATH:db},input:JSON.stringify(mode),encoding:'utf8'}));
 assert.deepEqual(run({mode:'check'}),{ready:true});assert.equal(run({mode:'watermark'}).rowid,8);
 const found=run({mode:'replies',phone:'+14155550123',transport:'sms',after:1}).messages;
 assert.equal(found.length,2);assert.equal(found[0].text,'right');assert.equal(found[1].unsupported,true);assert.equal(found[1].rowid,7);
 }finally{rmSync(dir,{recursive:true});}
});
