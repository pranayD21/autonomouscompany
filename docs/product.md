# Product and business direction

## Customer problem

People facing confusing medical bills and insurance claims must compare documents, repeat information over calls, obtain missing records, and remember follow-up dates. The proposed service takes on those administrative tasks and reports evidence-backed outcomes.

The initial customer may be the patient or a caregiver handling the patient's paperwork. We have not established a validated customer segment, pricing model, conversion rate, savings rate, or market size in this conversation.

## Proposed first workflow

1. Receive a bill and EOB; request missing documents.
2. Extract amounts and relevant fields with source references.
3. Investigate apparent discrepancies without declaring every mismatch an error.
4. Contact billing or the insurer within the person's authorization.
5. Record the reference number, requested documents, promised action, and follow-up date.
6. Resume the case when a reply or document arrives.
7. Verify the revised documents and report the actual outcome.

Suggested case states: uploaded, needs information, investigating, contacting, awaiting response, verifying, resolved, or human help needed. The current local prototype has a much smaller state model; see architecture.md.

## Company operations

A complete demo can include opt-in customer intake, eligibility assessment, case delivery, updates, cost tracking, and a service fee after verification. A 15% success fee was discussed only as an illustrative demo assumption; it is not approved pricing or a validated legal/commercial model. Use Stripe test mode for demonstrations.

Track case outcomes, autonomous actions, human interventions, model/call/email costs, and exception-handling effort. Insurer payment to a provider is not automatically patient savings or a patient refund.

## Hackathon fit

Primary targets: overall competition and People's Choice. A scaling/unicorn category is plausible if there is evidence of demand and sustainable case economics. Best Mobile Automation requires a meaningful real-phone workflow, such as retrieving claim status through an authorized app; telephony alone does not establish that fit. Best Design can be supported by a clear case timeline and understandable evidence.

The supplied event page uses inconsistent names for some prize categories. Confirm final category names with organizers. Avoid depending on hospital or insurer staff responding during the weekend.

## Proposed sponsor roles

- Naïve: required agent orchestration and operation.
- Neon: selected database, Auth, Functions, Realtime, and AI Gateway.
- AgentMail: proposed email inbox and follow-up.
- OpenAI: optional document interpretation/investigation; voice was superseded by the user's Agent Phone/ElevenLabs direction.
- Vercel: possible frontend host; no frontend deployment was completed here.
- Stripe: optional service-fee checkout after the workflow works.
- Mobilerun: optional mobile automation track integration.
- Apify: optional public billing-policy and contact research.
- HubSpot: optional opt-in prospect/customer tracking.
- Monid: evaluate only for a specific missing tool.
- OpenRouter: optional alternative models; avoid redundant routing.
- Luxor: no immediate need for custom compute in this prototype.

Except Neon, these are planning choices, not verified integrations in the local scaffold.
