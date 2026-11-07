export async function listFollowUpMessages() {
  const key=process.env.AGENTMAIL_API_KEY;
  const inbox=process.env.AGENTMAIL_INBOX_ID;
  if(!key || !inbox) throw new Error("AgentMailNotConfigured");
  const response=await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages`,{
    headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000),
  });
  if(!response.ok) throw new Error(`AgentMailHTTP${response.status}`);
  return response.json();
}
