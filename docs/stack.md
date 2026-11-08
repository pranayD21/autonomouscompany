# Account setup and agent stack

The operator selected agentphone.ai and the existing Naïve company. Account setup uses the operator's Dia session through Playwriter. Never put passwords or API keys in this document.

## Naïve

The hackathon portal confirmed $250 awarded credits and Pro free through November 30, 2026. Studio showed $251 available before testing. No plan purchase or top-up was performed.

Installed `@usenaive-sdk/managed-agents`, `@usenaive-sdk/cli`, and `@usenaive-sdk/blueprints`. `naive.config.ts` declares five agents: coordinator, intake, investigator, advocate, verifier. Each has a $2 monthly cap and $0.25 task cap. The user directed use of the hackathon credits after these proposed limits were presented. Tools default to deny; the coordinator can delegate only to the named specialists. Specialists draft and investigate; none has a calling or sending tool enabled.

A dedicated `bill-advocate-runtime` key has agents:read/write and sessions:read/write scopes. It is in ignored `.env.local`, mode 0600. The existing CEO and company configuration were preserved.

Run `node --env-file=.env.local node_modules/.bin/naive up --dry-run` before applying. Initial apply created four specialists but refused the coordinator because the CLI sets the roster in a second phase and `handoffs: "team"` requires it at creation. Explicit specialist-name handoffs fix this; the second apply created the coordinator and reported all four specialists unchanged.

`backend/providers/naive.ts` uses the official SDK and validates structured output. `advocacy_crew_runs` stores one immutable request per case revision with an idempotency key, so retry after a timeout uses the same request. POST `/cases/:id/crew` starts or retrieves that request; GET reads provider status/output and persists a validated final review; subsequent reads use the stored snapshot. Both check case ownership. Runs additionally require `CREW_ALLOWED_USER_IDS`, `NAIVE_COORDINATOR_ID`, and `NAIVE_RUN_BUDGET_MICRO_USD`. The run result is a plan, never verified savings. These endpoints are deployed; the live application check is documented in implementation-status.md.

## Voice and email

Current selection: **AgentPhone only** for new voice calls. Twilio/ElevenLabs setup and SIP are retired requirements. Historical records below remain for audit; see [current voice configuration](voice-agentphone.md).

Current direction: the user requested a workaround without AgentPhone. Local new-call code now targets ElevenLabs native Twilio telephony; Twilio signup, number setup, deployment, and live verification remain pending. Existing AgentPhone setup records below are historical. See [replacement setup](voice-twilio.md).

AgentPhone means **agentphone.ai**, not agentphone.app. Its native hosted voice and ElevenLabs over SIP are alternative call paths. SIP needs AgentPhone account enablement and a supported trunk configuration. Never attach one number to both call paths. Account setup and one authorized hosted-voice call are complete; see the verification records below.

ElevenLabs and AgentMail accounts and credentials are configured. One authorized synthetic email and its inbound reply are verified. Use synthetic test cases until consent and production data handling are implemented.

## Setup checks

`npm run stack:check` performs read-only account and connectivity checks, printing no secret values. An exit code of 1 means one or more required providers are missing or blocked. It does not prove calls or inference work.

`npm run test:e2e` runs a headless Chromium check against the preview at localhost:4173. It creates a synthetic example.com auth account and a synthetic case, deletes the case, and signs out. The test account remains; it sends no patient communications. Install the browser with `npx playwright install chromium` if needed. The current AI assertion checks the unavailable state because the gateway has no enabled model; successful inference remains unverified.

## Account setup results

- AgentPhone: account created through the operator's Google session; default agent and number provisioned. Demo number **+1 (412) 448-2627**, agent `cmw6zfr0z9qznrqhjo8i7mg3w`, number ID `cmw6zftbq9r37rqhjhzucl2b7`. Number provisioning consumed $3 of the $5 free credit, leaving $2. Hosted agent renamed Bill Advocate Demo and configured using `scripts/configure-agentphone.ts` and `backend/providers/voice-config.ts`. Messaging is disabled, prompt requires synthetic details and AI disclosure. SIP access requested; the service says it will email when enabled.
- ElevenLabs: Google account onboarding completed after the operator confirmed age eligibility. Free plan shows 10,000 credits. Created `bill-advocate-runtime-v2`, restricted to ElevenAgents write and Voices read, with a 1,000-credit refresh-period cap. Created agent `agent_7301m6w2sn52fehvcmb6vkx4rw9h` through `scripts/configure-elevenlabs.ts`; readback verifies authentication required, audio recording off, and 180-second maximum duration. Daily limit 10, concurrency 1, bursting off, retention 7 days. Free plan UI states personal/non-commercial use only: commercial use needs an appropriate license. No paid plan was selected.
- AgentMail: free account and `bill-advocate-pranay@agentmail.to` inbox created. Onboarding key is scoped: it can read that inbox's messages but cannot list/read inbox metadata. The check therefore uses the messages endpoint; do not broaden permissions merely to make a generic check pass. `backend/providers/agentmail.ts` is a server-side read adapter, not yet exposed in the case workflow. No email sent.
- Credentials: saved in ignored `.env.local`, never in committed source. Two initial keys (one AgentPhone, one ElevenLabs) appeared in browser tool output during setup. AgentPhone's initial key was revoked; ElevenLabs' initial key was disabled and replaced. Only replacement keys are configured. Browser snapshots must always redact all key prefixes, including during closing animations.

## Voice verification and blockers

The operator authorized a synthetic outbound test to their supplied number. `scripts/test-call.ts --place-authorized-test` made exactly one request with recording disabled. AgentPhone returned HTTP 402: “Add funds on the Billing page to place outbound calls.” No call ID was returned and no dial was confirmed. The script records attempts under ignored `test-results/` and refuses automatic duplicate attempts. Do not clear that guard or retry until the rejection is resolved and the intended test is confirmed. Outbound calling, SIP-to-ElevenLabs routing, and audio quality remain unverified. The operator can call the demo number inbound; inspect that resulting call before claiming success.

## Application wiring

The crew migration was applied and the case Function redeployed with server-only Naïve credentials, coordinator ID, and run budget. `src/CrewReview.tsx` provides start/refresh controls and structured next actions. `CREW_ALLOWED_USER_IDS` now enables the operator's confirmed Assurance account; possession of another public signup account does not authorize spending company credits. Voice and mail credentials are configured server-side in the case Function. Case dispatch requires an allowed operator, allowed recipient, and explicit per-action authorization; destination lists remain empty. See outreach.md.

`npm run test:crew` starts one synthetic provider session, stores its ID in `test-results/crew-smoke.json`, and checks it on subsequent runs. The initial auto-model session completed three specialist turns but paused the verifier at a preflight budget check before any verifier spend. Cancelled that root session and changed the crew model to the live-catalog `qwen/qwen3.7-flash`, keeping all budgets unchanged, then reapplied and started a fresh test. The initial record is retained in `test-results/crew-smoke-initial.json`. A running session is not a pass; require valid final structured output and inspect delegated threads.

### Versioned roster correction

The second smoke run revealed that the blueprint CLI preserved specialist roster version 1 even after updating their models to version 2. The coordinator initially pinned all four specialists to version 2; the latest prompt revision pins version 3. When changing specialist configuration, check the actual published versions and update the roster pins in the same change; a successful apply report alone does not prove delegates use the new model. Cancelled the second stale-version test before rerunning.

Case deletion now rejects cases with crew records so a running request cannot be orphaned and retried under a fresh ID. A complete run cancellation/retention workflow remains future work. `scripts/e2e.ts` also checks missing/invalid bearer tokens, negative amounts, and rejection of spending by unlisted users.

### Structured-output contract

The corrected-roster test completed delegated work but ended with `stop_reason: error` because the coordinator returned prose without calling `submit_output`. Kept `structured_output_required` enabled, so the API never silently treats missing output as success. Updated both the coordinator prompt and the session message to require that tool explicitly. `test:crew` now exits 0 only for a completed, schema-valid result; 1 means terminal failure and 2 means pending/paused. Do not substitute a fabricated result when a provider session fails.

The smoke test also requires the known synthetic discrepancy of 80,000 cents, missing-information entries, and a human-help flag; schema shape alone is insufficient. Provider output remains a draft requiring review, especially any billing/legal generalizations that go beyond supplied evidence.

The operator subsequently authorized funding and a retry to the same test number. Opened AgentPhone Billing in Dia at their request; advised a $10 manual top-up if offered (displayed hosted rate $0.22/min), leaving auto-recharge and the recording add-on off. Top-up minimum is not yet verified because payment-method setup comes first. Funding and the single retry have since completed; do not run another outbound test under this authorization. This flag accepts only a previous HTTP 402 without a call ID and archives that refusal; it cannot retry a successful or ambiguous request.

### First complete crew result and content review

The corrected `submit_output` run completed with all four specialist outputs and a schema-valid 80,000-cent discrepancy. Coordinator cost: 1,549 micro-USD (reported session consumption; delegated threads share the coordinator budget). Human review found unsupported deadlines, exposure claims, and escalation advice in the draft. This is a provider integration success, not production-quality medical billing advice. Strengthened every agent's instructions to prohibit invented deadlines, fraud/legal conclusions, exposure/overcharge ceilings, and unsupported escalation. Evidence output now uses only three supplied-field identifiers, not agent opinions as evidence; summary and action lengths are bounded. The updated specialists are version 3 and the local roster pin is updated accordingly. Smoke assertions reject those unsupported patterns.

The operator completed a $25 AgentPhone top-up; the displayed balance became $27. Retried the authorized call once: HTTP 200, call ID `cmw7006zuahsurqhj8kjihh2x`, initial status ringing. No additional outbound call is authorized by this test. The completed result is recorded below.

### Completed phone test

The user confirmed the call went through. Provider readback: `status: completed`, `durationSeconds: 46`, no recording URL. This verifies the native AgentPhone hosted-voice path to the authorized test recipient. It does not verify ElevenLabs SIP routing or autonomous hospital contact. No hospital/insurer was called and no email was sent.

Neon sponsor-credit check: the hackathon claim link showed $250 waiting, but the console requires selecting a paid plan and updating billing information. No plan change or billing submission was made. The offer was not claimed; AI Gateway remains unavailable. Naïve inference uses its separate existing hackathon credits.

The coordinator explicitly allows `wait_for_agents` alongside `send_to_agent`. Naïve delegation dispatch returns immediately; the coordinator must park before submitting its final output. Earlier tests submitted before delegates finished and lost the result on wake-up. The prompt now requires all four results before final submission.

Final crew verification passed after allowing `wait_for_agents`: session `ses_nsvsww22q9pbsc4gygychc1rff` ended `idle/end_turn`, `output_valid: true`, with all four version-3 members ending normally. `npm run test:crew` exited 0 with `PASS Naive structured case review`. Output reports an unverified $800 variance and requires source documents/human authorization; it is not a verified saving. `npm run build` passed (262 modules; existing chunk-size warning). `npm run stack:check` connects to Postgres, Auth, Naïve, ElevenLabs, AgentPhone, and scoped AgentMail messages, but exits 1 because Neon AI Gateway has no enabled model. App-level authorized crew execution remains unverified because the operator allowlist is empty.

### Insurer-facing revision

The primary demo is now a workplace chemical-burn claim. All five Naïve prompts were updated for insurer/claims-administrator triage, coverage research questions, insurer correspondence, and distinct verified outcomes. Specialists were retargeted at version 4 and are now pinned to version 5 after progressive-intake corrections; budgets are unchanged. Claim-specific app intake, live review, progressive editing, and revision boundaries now pass. The subsequent version-5 content check asks three next questions and preserves unknown financial amounts; coverage suggestions remain unverified candidates. See insurance-workflows.md for the selected scope and implementation gaps.

The first explicitly authorized case-linked AgentMail test email was sent once and confirmed in the operator's Gmail inbox. The saved action refreshes as `sent`; temporary operator and recipient permissions were restored. Case-linked calling remains unverified. The authorized email later received a reply, which was imported and cited by a saved review; see replies.md. Scheduled reply monitoring is tracked in reply-monitoring.md.

### Assurance naming update

The product is now Assurance. App branding, source voice prompts, and new-call greetings use Assurance. The existing AgentPhone agent was updated in place and read back as `Assurance Demo`; no number was replaced and no call was placed. The ElevenLabs setup script now updates the existing agent's name and greeting in place, preserving its conversation settings. Its update endpoint follows the [official agent update API](https://elevenlabs.io/docs/api-reference/agents/update). Stable `bill-advocate` resource identifiers and prior test receipts retain their original names.

### Research-aware coordinator

The coordinator instructions now keep delegations under 6,000 characters and send relevant source text primarily to the investigator and verifier. This addresses the malformed/truncated handoff observed in the previous live test while retaining the same five agents, specialist versions, tool permissions, and approved caps. Official page retrieval happens in the case Function; no arbitrary browsing permission was added to agents.

Following a rejected live quotation result, the coordinator was changed to `openai/gpt-5.4-mini`. Other specialists retain `qwen/qwen3.7-flash`. A one-time same-session correction uses the same GPT model and the existing task budget; no budget increase or subscription purchase was made. Exact-source validation remains mandatory.

### Scheduled reply checks

The dedicated `replypoll` Function uses the existing scoped AgentMail key and inbox. It receives no Naïve or telephony credentials. Owners opt into 30-day monitoring of an authorized thread; reads do not grant permission for follow-up sends or inference. See [scheduled reply monitoring](reply-monitoring.md) for deployment and verification. The latest read-only provider check reached Postgres, Auth, Naïve, ElevenLabs, AgentPhone, and AgentMail; Gateway still had no enabled models, and AgentPhone returned zero configured SIP trunks.

## Autonomous case execution

The production backend now includes a scheduled Naïve decision worker and owner-scoped standing authorization endpoints. Coordinator version 17 uses intake version 7 and the other specialists at version 6, with all approved budget caps unchanged. Only the operator setup inbox is allowlisted for email. The approved own-inbox grant is active, and the first model-selected email was delivered. Reply-driven continuation remains under verification; see [autonomy.md](autonomy.md).

## Gateway billing check

The production catalog returned 63 models with zero enabled, all reporting `paid_plan_required`. The linked organization Billing page shows Free plan and $0 AI gateway balance. Its $250 credit offer requires selecting a paid plan and updating billing information; it is not an already usable gateway balance. No plan upgrade or credit purchase was made. Naïve credits are separate and continue to support the configured crew.
