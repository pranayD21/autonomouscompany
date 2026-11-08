import {config} from 'dotenv';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {naiveClient} from '../backend/providers/naive';
import {GMAIL_READ_SCOPE,GMAIL_READ_TOOLS,verifyReadonlyConfig} from '../backend/gmail-connection';
config({path:'.env.local',quiet:true});
const openapi=await(await fetch('https://api.vetta.sh/v1/openapi.json')).json();if(!openapi.paths?.['/v1/connections/auth_configs']?.post)throw Error('Current Naive API does not expose OAuth configuration.');
const client=naiveClient(process.env.NAIVE_SETUP_API_KEY??process.env.NAIVE_API_KEY),apply=process.argv.includes('--apply');
let after:string|undefined,found:string|undefined;
do{const page=await client.connections.listAuthConfigs({after,limit:100});for(const item of page.data){try{verifyReadonlyConfig(item);if(item.tools.length===GMAIL_READ_TOOLS.length)found=item.id;}catch{}}after=page.has_more?page.next_cursor??undefined:undefined;}while(after&&!found);
console.log(JSON.stringify({apply,operation:found?'reuse':'create',connector:'gmail',auth:'managed_oauth',scopes:[GMAIL_READ_SCOPE],tools:GMAIL_READ_TOOLS,customerConnectionsCreated:0}));
if(apply){const id=found??(await client.connections.createAuthConfig({connector:'gmail',auth:'managed_oauth',scopes:[GMAIL_READ_SCOPE],tools:GMAIL_READ_TOOLS})).id;let env=await readFile('.env.local','utf8');const line=`NAIVE_GMAIL_AUTH_CONFIG_ID=${JSON.stringify(id)}`;env=/^NAIVE_GMAIL_AUTH_CONFIG_ID=.*$/m.test(env)?env.replace(/^NAIVE_GMAIL_AUTH_CONFIG_ID=.*$/m,line):`${env.trimEnd()}\n${line}\n`;await writeFile('.env.local',env,{mode:0o600});await chmod('.env.local',0o600);console.log('Read-only Gmail configuration saved privately. No customer account connected and no email sent.');}
