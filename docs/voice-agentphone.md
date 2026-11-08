# AgentPhone-only voice

The user explicitly selected AgentPhone alone for new calls on November 7, 2026. No number purchase, SIP approval, or ElevenLabs connection is needed for AgentPhone hosted calling.

## Configuration and code

`OUTREACH_VOICE_PROVIDER=agentphone` is saved in the ignored local environment. `backend/providers/outreach.ts` and all voice-enabled Functions in `neon.ts` default to AgentPhone. Any other selector, including `elevenlabs`, disables new calls. New dispatch has only the direct AgentPhone API path. Old ElevenLabs-prefixed receipts can still be read/reconciled with their original provider, and are never retried through AgentPhone.

`AGENTPHONE_API_KEY`, `AGENTPHONE_AGENT_ID`, and `AGENTPHONE_NUMBER_ID` remain server-only. Case authorization, dispatch reservation, and no-automatic-redial handling remain in force, and legacy grants keep their operator, approved-recipient, and immutable discussion-plan checks. Selecting the provider does not authorize a new call. The authenticated stack-status response exposes `outreach.callProvider` and `callConfigured` for deployment verification. Neither field establishes live delivery.

`scripts/stack-check.ts` checks the selected hosted AgentPhone agent and active number. `scripts/agentphone-outreach.test.ts` verifies direct requests, recording disabled, default routing, rejected alternative selectors, and no retry/failover. `scripts/elevenlabs-outreach.test.ts` verifies disabled new dispatch plus historical status reads. The isolated database test fixture in `scripts/outreach.test.ts` expects AgentPhone requests.

## Verification

Live read-only provider check returned HTTP 200, confirmed the configured hosted agent, and matched the active configured number. Eleven voice/general-version transport tests and the build passed. All six Functions deployed successfully with the AgentPhone-only selector. Neon readback showed completed deployments for cases (53), tools (11), and autopoll (19), each declaring the voice selector and AgentPhone credentials. That check placed no call. Real onboarding call records are in [phone onboarding](phone-onboarding.md).

## Standalone voice capability disclosure

A separately authorized direct AgentPhone test completed for 120 seconds. Its private receipt is retained in ignored test-results files. This call used the historical hosted demo persona directly, without an Assurance case or Naïve session binding. It verifies a connected voice conversation only. The persona prompt distinguishes the case advocate’s research, email and call tools from the standalone line, and avoids directing the caller to perform administrative work as the default. Prompt text cannot create a tool connection or queue work. The case-bound path is [phone onboarding](phone-onboarding.md). Provider prompt readback is recorded in the change log.

## Product wording and standalone line

The source configuration in `backend/providers/voice-config.ts` names the service Assurance and describes the standalone information line. This line has no case tools and directs customers to secure connected onboarding rather than collecting sensitive intake itself. Connected phone onboarding has its own case-bound prompt; legacy synthetic outreach calls remain restricted to their test authorization. Source edits do not update the hosted provider; `scripts/configure-agentphone.ts` applies the standalone configuration.
