# AgentPhone-only voice

The user explicitly selected AgentPhone alone for new calls on November 7, 2026. Twilio and ElevenLabs are no longer pending setup requirements. No number purchase, SIP approval, or ElevenLabs connection is needed for AgentPhone hosted calling.

## Configuration and code

`OUTREACH_VOICE_PROVIDER=agentphone` is saved in the ignored local environment. `backend/providers/outreach.ts` and all voice-enabled Functions in `neon.ts` default to AgentPhone. Any other selector, including `elevenlabs`, disables new calls. New dispatch has only the direct AgentPhone API path. Old ElevenLabs-prefixed receipts can still be read/reconciled with their original provider, and are never retried through AgentPhone.

`AGENTPHONE_API_KEY`, `AGENTPHONE_AGENT_ID`, and `AGENTPHONE_NUMBER_ID` remain server-only. The current case owner/operator authorization, approved recipient checks, immutable discussion plan, dispatch reservation, and no-automatic-redial handling remain in force. Selecting the provider does not authorize a new call. The authenticated stack-status response exposes `outreach.callProvider` and `callConfigured` for deployment verification. Neither field establishes live delivery.

`scripts/stack-check.ts` checks the selected hosted AgentPhone agent and active number; ElevenLabs is no longer a required diagnostic. `scripts/agentphone-outreach.test.ts` verifies direct requests, recording disabled, default routing, rejected alternative selectors, and no retry/failover. `scripts/elevenlabs-outreach.test.ts` now verifies disabled new dispatch plus historical status reads. The isolated database test fixture in `scripts/outreach.test.ts` now expects AgentPhone requests.

## Verification

Live read-only provider check returned HTTP 200, confirmed the configured hosted agent, and matched the active configured number. Eleven voice/general-version transport tests and the build passed. The database-backed outreach suite was not rerun. All six Functions deployed successfully with the AgentPhone-only selector. Neon readback shows completed deployments for cases (53), tools (11), and autopoll (19), each declaring the voice selector and AgentPhone credentials. Authenticated app readiness readback remains unverified: a retained test session timed out, and fresh signup did not retain a session during the follow-up check. No successful live-readback claim is made. No call was placed. A fresh authorized case-linked call is still required to verify the complete application path.
