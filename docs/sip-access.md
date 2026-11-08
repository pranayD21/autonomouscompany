# AgentPhone SIP access

## Current blocker

On November 7, 2026, a live check with the configured AgentPhone account returned HTTP 200 and an empty trunk list from `GET /v1/sip-trunks`. A trunk creation request with JSON body `{"name":"Assurance ElevenLabs"}` returned HTTP 403: “SIP trunking isn’t enabled for your account yet. Request access from the SIP trunking tab and we’ll get you set up.” Request ID: `e593e1da-699b-4c0c-931f-eb9cc874751a`.

No trunk was created, no number routing changed, and no call was placed. This confirms account enablement is the blocker, rather than a missing local SIP hostname or an ElevenLabs credential error. The earlier dashboard access request remains pending according to the setup record. The browser used for this recheck was signed out, so dashboard approval status was not independently inspected.

## Required provider action

AgentPhone must enable SIP for the account associated with the existing Assurance number. Give its team the request ID above and explain that the requested integration is AgentPhone telephony with the existing ElevenLabs voice agent. An API key or funded account alone does not enable SIP. Do not invent connection credentials or repeatedly recreate access requests.

## After enablement

1. Recheck the trunk list before creating anything, to avoid duplicate trunks.
2. Create the trunk and store returned authentication details privately. Use the actual returned termination address and supported authentication settings.
3. Configure ElevenLabs and the trunk origination destination for the correct inbound/outbound directions.
4. Coordinate application dispatch changes before switching the existing number: the current case-call adapter uses AgentPhone hosted calls. A SIP-routed number cannot simultaneously use that hosted call endpoint.
5. Verify inbound and outbound audio with an explicitly authorized test recipient. Provisioning alone does not verify working calls.

The existing hosted AgentPhone route remains available and previously passed an authorized test. SIP is required for the selected ElevenLabs connection, not for all AgentPhone calling.

## References and configuration

- [AgentPhone SIP setup and account gating](https://docs.agentphone.to/sip-trunking.md)
- [Create trunk API](https://docs.agentphone.to/api-reference/sip-trunks/create-sip-trunk-v-1-sip-trunks-post.md)
- `AGENTPHONE_API_KEY` in ignored `.env.local` authenticates the checks. Never print its value or returned trunk passwords.
- Existing service configuration and prior call verification: [stack operations](stack.md).
- Case dispatch authorization and retry behavior: [outreach](outreach.md).

Verification: authenticated list and create requests ran against the live provider. Trunk creation was rejected; no SIP integration success is claimed. No application tests were needed for this documentation-only change.
