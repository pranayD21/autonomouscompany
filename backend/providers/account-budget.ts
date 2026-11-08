import type {naiveClient} from './naive';
type Client=ReturnType<typeof naiveClient>;
/** Naïve requires numeric agent/session caps; derive them from prepaid account funds. */
export async function accountCreditBudget(client:Pick<Client,'credits'>){
 const account=await client.credits.show();
 if(!Number.isSafeInteger(account.balance_micro_usd)||account.balance_micro_usd<=0)throw Error('NAIVE_ACCOUNT_CREDITS_REQUIRED');
 return account.balance_micro_usd;
}
export async function accountAgentBudget(client:Pick<Client,'credits'|'agents'>,agentId?:string){
 const balance=await accountCreditBudget(client);
 const spent=agentId?(await client.agents.spend(agentId)).spent_micro_usd:0;
 if(!Number.isSafeInteger(spent)||spent<0||!Number.isSafeInteger(spent+balance))throw Error('INVALID_PROVIDER_SPEND');
 return {cap_micro_usd:spent+balance,max_task_micro_usd:spent+balance,period:'month' as const};
}
