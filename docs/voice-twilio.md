# ElevenLabs voice with native Twilio telephony

**Superseded.** The user explicitly selected direct AgentPhone only on November 7, 2026. New calls do not support ElevenLabs/Twilio selection; any other `OUTREACH_VOICE_PROVIDER` value disables new calls. The records below are historical, not instructions to buy or configure anything. See [AgentPhone-only calling](voice-agentphone.md).

Never retry an ambiguous historical call through another provider. Historical `elevenlabs:<id>` receipts remain readable through `/v1/convai/conversations/{id}` in `backend/providers/outreach.ts`, which uses the `ELEVENLABS_API_KEY` that `neon.ts` still declares. The call SID is stored in `provider_thread_id`. Status reads retain status and duration only.

## Earlier replacement attempt

On November 7, 2026 the user asked to replace AgentPhone with ElevenLabs' native Twilio integration, because SIP enablement was not available in time. `scripts/configure-elevenlabs-twilio.ts` set up and read back the dedicated `Assurance Case Outreach` agent, with its ID stored only in the private environment. An adapter passed six transport checks and `npm run build`, and it was deployed disabled. No number was imported and no call ran on this path.

## Official references

- [Native Twilio integration](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration/)
- [Import number](https://elevenlabs.io/docs/eleven-agents/api-reference/phone-numbers/create)
- [Outbound call](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call)
- [Conversation details](https://elevenlabs.io/docs/api-reference/conversations/get)

## Upgrade submission diagnosis

The operator filled the individual account and tax-address form, but submission failed with a generic UI message. A single retry exposed the underlying Trust Hub response: primary compliance profile not approved; complete KYC in Trust Hub. The address itself was present. Navigated to Trust Hub → Individual Profile → Profile details, where Persona requires identity-verification consent. The operator handled that step; no biometric consent, identity document, payment, or number purchase was submitted by the agent. Do not store the operator’s address or identity documents in this repository.

The operator completed Persona verification; Trust Hub then showed the Individual primary profile as Approved. Re-entered the previously supplied account/tax details, selected the matching address suggestion, and submitted successfully after a transient initial rejection. Prepared the displayed $20 starting balance with auto-recharge disabled. Payment step shows a $20 total and secure payment/address fields. Payment went to the operator; the agent made no purchase.

## Funded account confirmed

The operator supplied a funding receipt. After leaving the stale upgrade wizard and reloading the console, Twilio showed Active with $20.00 available. Prepared a Bay Area local voice-capable number at the purchase review: $1.15 immediately, then $1.15/month plus usage. The operator declined number rental; no number was purchased. The prior payment screen was stale and did not reflect the funded account.

## Move to AgentPhone

The provider selector was added to allow a direct AgentPhone path without ElevenLabs or SIP. Invalid values disable calling. There is no automatic provider failover or redial, and receipt status reads stay tied to their original provider across configuration changes. Eleven combined voice transport tests passed, including direct AgentPhone routing, timeout/no-retry behavior, uncertain receipt handling, invalid configuration, and historical ElevenLabs status after selection changes. Build passed.

## Direct AgentPhone readback

A fresh authenticated GET confirmed the configured Assurance agent used hosted voice and owned the configured active number. Reloaded billing showed $26.83 available. The provider-aware stack diagnostic checks that agent identity, hosted mode, and active number match before reporting connectivity. No live call was placed. The full diagnostic exited 1 because Neon gateway models were disabled and Naïve returned a transient rate-limit response; AgentPhone, AgentMail, ElevenLabs, Postgres, and Auth checks passed. Build passed with the bundle warning.
