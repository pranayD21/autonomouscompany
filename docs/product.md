# Product and business direction

Product name: **Assurance**. Selected by the user on November 7, 2026.


## Customer problem and direction

An injured person or policyholder needs someone to keep their insurance claim moving: organize evidence, submit the right information, explain insurer responses, and follow up without repeatedly telling the same story. The product is a communication and case-management layer between that person and the insurer or claims administrator.

The user selected insurer-facing advocacy over hospital-facing bill negotiation. Two intended use cases are workplace injury claims and health-insurance claim disputes after medical care. Keep their intake, documents, and procedural steps distinct; share authorization, communication, evidence tracking, and updates. The primary beneficiary is the injured person. Employer purchasing or employer-assisted filing remains an open business-model question.

We have not validated pricing, conversion, claim success rates, or market size.

## Selected first demo

A worker suffers a chemical burn at a pharmaceutical office. Starting with contact details, injury description, and an insurance card, the company progressively collects evidence, researches relevant employer/personal coverage, manages supported claims and insurer follow-up, and reconciles final bills. The aim is benefits the person is entitled to and the lowest verified responsibility supported by their coverage and corrected billing. Do not guarantee payment or a zero balance. See insurance-workflows.md for the complete sequence and authorization model.

## Intended workflow

1. Identify the claim type, insurer/claims administrator, current stage, and the person's requested outcome.
2. Collect the relevant claim documents and record source references; ask for missing evidence.
3. Explain the insurer's stated decision or outstanding request without guessing coverage or entitlement.
4. Prepare the submission, document request, status inquiry, or evidence-backed dispute for review.
5. Obtain authorization for the exact recipient and external action, then communicate with the insurer.
6. Record receipt/reference number, outstanding documents, stated next action, and a source-backed follow-up date.
7. Resume on a response and verify the actual claim decision, payment, or revised responsibility.

Report claim acceptance, payment to a provider, benefits paid to the person, and reduced patient responsibility separately. None should be invented from a bill/EOB mismatch. See [insurance workflows](insurance-workflows.md) for the two paths and current implementation gaps.

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

Naïve, Neon, AgentPhone, AgentMail, and ElevenLabs accounts are configured. Core case/crew and selected communication paths are verified; see implementation-status.md for exact scope. The other sponsors remain optional.
