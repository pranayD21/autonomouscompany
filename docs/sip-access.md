# AgentPhone SIP access

**Superseded.** New calls use AgentPhone hosted calling alone, with no SIP or ElevenLabs connection; see [AgentPhone voice](voice-agentphone.md). This page is the record of the SIP access check.

## November 7, 2026 check

On November 7, 2026, a live check with the configured AgentPhone account returned HTTP 200 and an empty trunk list from `GET /v1/sip-trunks`. A trunk creation request with JSON body `{"name":"Assurance ElevenLabs"}` returned HTTP 403: “SIP trunking isn’t enabled for your account yet. Request access from the SIP trunking tab and we’ll get you set up.” Request ID: `e593e1da-699b-4c0c-931f-eb9cc874751a`.

No trunk was created, no number routing changed, and no call was placed. Account enablement was the blocker, rather than a missing local SIP hostname or an ElevenLabs credential error. An API key or funded account alone does not enable SIP. A SIP-routed number cannot simultaneously use the hosted call endpoint that the case-call adapter uses.

SIP was needed only for the ElevenLabs connection, not for AgentPhone calling. The hosted AgentPhone route is the selected path.

## References and configuration

- [AgentPhone SIP setup and account gating](https://docs.agentphone.to/sip-trunking.md)
- [Create trunk API](https://docs.agentphone.to/api-reference/sip-trunks/create-sip-trunk-v-1-sip-trunks-post.md)
- `AGENTPHONE_API_KEY` in ignored `.env.local` authenticates the checks. Never print its value or returned trunk passwords.
- Existing service configuration and prior call verification: [stack operations](stack.md).
- Case dispatch authorization and retry behavior: [outreach](outreach.md).

Verification: authenticated list and create requests ran against the live provider. Trunk creation was rejected; no SIP integration exists.
