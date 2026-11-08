# ElevenLabs voice with native Twilio telephony

Current instruction: do not purchase a Twilio number. If Twilio encounters another issue, switch to AgentPhone directly without ElevenLabs, using its existing balance. This preference supersedes the earlier request to avoid AgentPhone. An explicit provider selector is implemented locally; the deployed adapter and live selection remain unchanged. Verify direct AgentPhone calling access before use, preserve case authorization and limits, and never retry an ambiguous Twilio call through another provider.

## Selected replacement

The user requested replacing AgentPhone on November 7, 2026 because its SIP enablement cannot be obtained during the hackathon. New case calls use ElevenLabs’ native Twilio integration. This preserves ElevenLabs voice and case authorization without AgentPhone SIP. Twilio is now Active with approved identity and a confirmed $20 balance. The replacement adapter is deployed but disabled; number provisioning and live call verification are pending.

## Account setup

0. To prepare the ElevenLabs agent independently, run `npx tsx scripts/configure-elevenlabs-twilio.ts --agent-only`. This needs only `ELEVENLABS_API_KEY`, verifies the saved prompt/authentication/recording/duration settings, and exits before any Twilio credential or number operation. The dedicated `Assurance Case Outreach` agent has been created and read back successfully. Its ID is stored only in the private environment. No call was placed.
1. Create a Twilio account and complete its identity/phone verification. Obtain a voice-capable number. A purchased Twilio number supports both inbound and outbound calls; a verified caller ID supports outbound only. Trial destination restrictions may apply; verify them before a test. No purchase, plan change, or trial availability is guaranteed by this code.
2. Enter `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` through private credential entry into ignored `.env.local`. Do not paste credentials into chat or commit them. Existing `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are reused.
3. Run `npx tsx scripts/configure-elevenlabs-twilio.ts`. This creates/reuses the dedicated `Assurance Case Outreach` agent, checks privacy and duration settings, imports/reuses the selected Twilio number with SMS configuration disabled, and stores `ELEVENLABS_OUTREACH_AGENT_ID` and `ELEVENLABS_PHONE_NUMBER_ID` privately. It places no call. Number import configures Twilio voice routing through ElevenLabs. Use a number dedicated to this demo.
4. Existing number imports are reused without reassigning their inbound agent. New imports assign the original Assurance demo agent for inbound conversations; outbound case calls select the dedicated outreach agent. Check inbound assignment in ElevenLabs if reusing an import.
5. Deploy the case Function with the three ElevenLabs variables in `neon.ts`, then verify configuration through the authenticated app. Twilio setup credentials are not deployed to Neon.
6. Authorize one reviewed synthetic case action to an agreed test recipient through the existing case workflow. Check conversation receipt, audible content, termination, and status/duration before claiming success. Inbound behavior requires a separate test.

## Runtime behavior

`backend/providers/outreach.ts` requires `ELEVENLABS_API_KEY`, `ELEVENLABS_OUTREACH_AGENT_ID`, and `ELEVENLABS_PHONE_NUMBER_ID`. A legacy AgentPhone key does not enable new calls. Before dialing, it reads the outreach agent and verifies the exact plan-aware prompt, required authentication, voice recording disabled, and the 180-second cap. The immutable discussion plan is JSON-encoded in the `discussion_plan` dynamic variable and cannot override the agent’s instructions.

A POST to `/v1/convai/twilio/outbound-call` disables Twilio recording and uses a 25-second ringing timeout. Success requires both conversation ID and Call SID. The conversation ID is persisted as `elevenlabs:<id>`; the Call SID uses the existing `provider_thread_id` column. Timeout, success=false, or incomplete receipts remain uncertain, with no automatic redial. Existing dispatch reservation, ownership, revision, recipient allowlist, and explicit authorization checks remain in force.

Status reads use `/v1/convai/conversations/{id}`, verify the receipt, and retain status/duration only. Historical unprefixed call receipts still use AgentPhone GET requests. No new call uses AgentPhone. The browser confirmation describes ElevenLabs transcript handling; recording disabled does not mean no transcript.

## Files and verification

- `backend/providers/voice-config.ts`: dedicated outreach prompt with the discussion-plan variable.
- `backend/providers/outreach.ts`: preflight, one-shot dispatch, receipts, and status routing.
- `scripts/configure-elevenlabs-twilio.ts`: setup and readback; no calls or automatic purchases.
- `scripts/elevenlabs-outreach.test.ts`: six isolated transport checks; run `npx tsx --test scripts/elevenlabs-outreach.test.ts`.
- `scripts/outreach.test.ts`: existing database/concurrency suite, updated provider request fixture. Requires an isolated `OUTREACH_TEST_DATABASE_URL`; not rerun for this change.
- `.env.example`, `neon.ts`: variable names and server-only environment delivery.
- `scripts/stack-check.ts`: imported-number readiness replaces AgentPhone as a required calling check.
- `src/Outreach.tsx`: provider-accurate authorization text.

Six transport checks and `npm run build` passed. The native adapter is deployed and the dedicated ElevenLabs agent is provisioned. No number import or live replacement inbound/outbound call has succeeded yet. The existing ElevenLabs free-plan commercial-use limitation remains unresolved; see stack.md.

## Official references

- [Native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration/)
- [Import number](https://elevenlabs.io/docs/eleven-agents/api-reference/phone-numbers/create)
- [Outbound call](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call)
- [Conversation details](https://elevenlabs.io/docs/api-reference/conversations/get)

## Upgrade submission diagnosis

The operator filled the individual account and tax-address form, but submission failed with a generic UI message. A single retry exposed the underlying Trust Hub response: primary compliance profile not approved; complete KYC in Trust Hub. The address itself was present. Navigated to Trust Hub → Individual Profile → Profile details, where Persona requires identity-verification consent. Left that step for the operator; no biometric consent, identity document, payment, or number purchase was submitted by the agent. After approval, resume the saved upgrade and inspect the Balance quote before funding. Do not store the operator’s address or identity documents in this repository.

The operator completed Persona verification; Trust Hub now shows the Individual primary profile as Approved. Re-entered the previously supplied account/tax details, selected the matching address suggestion, and submitted successfully after a transient initial rejection. Prepared the displayed $20 starting balance with auto-recharge disabled. Payment step shows a $20 total and secure payment/address fields. Handed payment to the operator; no purchase has been made by the agent. Number provisioning and a newly authorized call still remain.

## Funded account confirmed

The operator supplied a funding receipt. After leaving the stale upgrade wizard and reloading the console, Twilio showed Active with $20.00 available. Do not request another upgrade deposit. Prepared a Bay Area local voice-capable number at the purchase review: $1.15 immediately, then $1.15/month plus usage. The operator declined number rental; no number was purchased. The prior payment screen was stale and did not reflect the funded account.

## Explicit AgentPhone fallback

`OUTREACH_VOICE_PROVIDER` defaults to `elevenlabs`. Set it to `agentphone` only when applying the user’s fallback instruction. Invalid values disable calling. AgentPhone mode uses the existing key, agent, and number directly, without ElevenLabs or SIP. Requests preserve the synthetic discussion plan and disable audio recording. There is no automatic provider failover or redial. Receipt status reads remain tied to their original provider across configuration changes. The scheduler and API configuration both declare the selector and required provider variables. The UI confirmation now describes the configured provider instead of naming ElevenLabs unconditionally.

Eleven combined voice transport tests passed, including direct AgentPhone routing, timeout/no-retry behavior, uncertain receipt handling, invalid configuration, and historical ElevenLabs status after selection changes. Build passed. These changes are local and not deployed; no live call or provider switch occurred. Current AgentPhone account access still needs readback and an authorized test before claiming readiness.

## Direct AgentPhone readback

A fresh authenticated GET confirmed the configured Assurance Demo agent uses hosted voice and owns the configured active number. Reloaded billing shows $26.83 available. The provider-aware stack diagnostic now checks that agent identity, hosted mode, and active number match before reporting connectivity. No live call was placed and the runtime selection remains unchanged. The full diagnostic exited 1 because Neon gateway models remain disabled and Naïve returned a transient rate-limit response; AgentPhone, AgentMail, ElevenLabs, Postgres, and Auth checks passed. Build passed with the existing bundle warning.
