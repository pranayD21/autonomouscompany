# Persistent workflow migration

The user's current instruction replaces the bounded synthetic-demo workflow. New cases receive one ongoing Naïve case session after the owner gives permission in their own words. The agent writes its goal and finish condition, chooses research, contacts, communications and wake times, and decides when to finish or ask for information. No repository decision/message counts, contact spacing, case expiry, recipient list, review prerequisite, or fixed case objective governs this path.

Keep account isolation, credential revocation, signed webhooks, source integrity, evidence attribution, and send-once reconciliation. The Naïve transport governor controls request admission and temporary retry cooldowns only; it must not end cases or impose a case-work allowance. Authentication OTP expiry and login abuse controls are independent of case duration.

## Verified provider constraints

Current Naïve docs were read from usenaive.ai/docs/api/agents.md, sessions.md, and vaults.md. Agents require a numeric budget; sessions always have a cap and inherit max_task_micro_usd if none is supplied. A session budget cannot be null. Therefore simply removing budget fields does not remove the provider's existing $0.25 setting. The migration must derive required settings from the organization credit balance and use the documented session budget update for the same session when necessary. No top-up is implied or authorized.

Vault credentials support expires_at=null. A case-bound non-expiring credential, revoked when its case authority closes, avoids the failed create-new/delete-old mid-session rotation. This is the closest native mechanism to uninterrupted case access without a credential expiring mid-case. Existing short-lived credentials must not be silently upgraded or old test grants expanded; legacy cases require a fresh owner consent under the new path.

AgentMail sends support Idempotency-Key, with a documented provider retention window. Our durable dispatch ledger must still prevent duplicate sends after that window. AgentPhone call creation has no verified idempotency equivalent; ambiguous call dispatches remain unresolved until reconciled, never automatically redialled.

## Current recovery state

The main task stopped during remote cleanup of an existing revoked rotation-test fixture after real HTTP 429 responses. Its local authority and credentials are revoked and it has zero outbound actions. The shared governor recorded request req_dn41s1pj51w5480djsgkwgnaky and is honoring its cooldown. A later retry returned request req_6x7x7xsyz5hqq6eak2zd6x08h3 with the same capacity error. Retry that same fixture after its shared cooldown; do not create another test session or bypass the governor. This remote cleanup does not block local migration work.

Implementation is in progress. This document records the approved direction and verified API boundaries, not completed or deployed behavior.

Initial migration modules are backend/open-case-policy.ts (owner-written permission without work limits) and backend/providers/account-budget.ts (mandatory provider budgets derived from current credits and provider-reported spend). They are not active entry points until the remaining workflow migration is integrated and tested. Do not deploy these preparatory files as proof the bounded path has been retired.
