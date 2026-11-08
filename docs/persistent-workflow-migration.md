# Persistent workflow migration

The user's current instruction replaces the bounded synthetic-demo workflow. New cases receive one ongoing direct-model case run after the owner gives permission in their own words. The user selected minimal Naïve use after repeated HTTP 429 failures; legacy Naïve sessions remain separate. The agent writes its goal and finish condition, chooses research, contacts, communications and wake times, and decides when to finish or ask for information. No repository decision/message counts, contact spacing, case expiry, recipient list, review prerequisite, or fixed case objective governs this path.

Keep account isolation, credential revocation, signed webhooks, source integrity, evidence attribution, and send-once reconciliation. The Naïve transport governor controls request admission and temporary retry cooldowns only; it must not end cases or impose a case-work allowance. Authentication OTP expiry and login abuse controls are independent of case duration.

## Verified provider constraints

Current Naïve docs were read from usenaive.ai/docs/api/agents.md, sessions.md, and vaults.md. Agents require a numeric budget; sessions always have a cap and inherit max_task_micro_usd if none is supplied. A session budget cannot be null. Therefore simply removing budget fields does not remove the provider's existing $0.25 setting. The migration must derive required settings from the organization credit balance and use the documented session budget update for the same session when necessary. No top-up is implied or authorized.

Vault credentials support expires_at=null. A case-bound non-expiring credential, revoked when its case authority closes, avoids the failed create-new/delete-old mid-session rotation. This is the closest native mechanism to uninterrupted case access without a credential expiring mid-case. Existing short-lived credentials must not be silently upgraded or old test grants expanded; legacy cases require a fresh owner consent under the new path.

AgentMail sends support Idempotency-Key, with a documented provider retention window. Our durable dispatch ledger must still prevent duplicate sends after that window. AgentPhone call creation has no verified idempotency equivalent; ambiguous call dispatches remain unresolved until reconciled, never automatically redialled.

## Current implementation and recovery

The existing rotation-test session was cancelled and its remote vault credentials, vault, identity, and local fixture rows were cleaned on November 8, 2026 UTC. The cleanup confirmed zero outbound rows. No replacement fixture or remote session was created.

The new hosted path uses authority-bound non-expiring credentials and revocation, rather than the failed mid-session rotation mechanism. Owner activation, direct execution, and provider-independent document extraction are implemented. See [hosted-agent.md](hosted-agent.md) for the runtime and [implementation-status.md](implementation-status.md) for deployment evidence. Legacy grants keep their original limits; the direct path does not silently expand them.
