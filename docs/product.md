# Product and business direction

Product name: **Assurance**. Selected by the user on November 7, 2026.


## Customer problem and direction

An injured person or policyholder needs someone to keep their insurance claim moving: organize evidence, submit the right information, explain insurer responses, and follow up without repeatedly telling the same story. The product is a communication and case-management layer between that person and the insurer or claims administrator.

The user selected insurer-facing advocacy over hospital-facing bill negotiation. Two supported product paths are workplace injury claims and health-insurance claim disputes after medical care. Keep their intake, documents, and procedural steps distinct; share authorization, communication, evidence tracking, and updates. The primary beneficiary is the injured person.

## Reference workplace-injury scenario

A worker suffers a chemical burn at a pharmaceutical office. Starting with contact details, injury description, and an insurance card, the company progressively collects evidence, researches relevant employer/personal coverage, manages supported claims and insurer follow-up, and reconciles final bills. The aim is benefits the person is entitled to and the lowest verified responsibility supported by their coverage and corrected billing. Do not guarantee payment or a zero balance. See insurance-workflows.md for the complete sequence and authorization model.

## Case workflow

1. Identify the claim type, insurer/claims administrator, current stage, and the person's requested outcome.
2. Collect the relevant claim documents and record source references; ask for missing evidence.
3. Explain the insurer's stated decision or outstanding request without guessing coverage or entitlement.
4. Prepare the submission, document request, status inquiry, or evidence-backed dispute for review.
5. Communicate within the owner’s standard handling scope; request additional authorization when an action falls outside that scope.
6. Record receipt/reference number, outstanding documents, stated next action, and a source-backed follow-up date.
7. Resume on a response and verify the actual claim decision, payment, or revised responsibility.

Report claim acceptance, payment to a provider, benefits paid to the person, and reduced patient responsibility separately. None should be invented from a bill/EOB mismatch. See [insurance workflows](insurance-workflows.md) for the two paths.

## Company operations

Company operations include authorized intake, case delivery, updates, and cost tracking. Finance tools remain restricted to Stripe test mode; real fee collection is not authorized.

Track case outcomes, autonomous actions, human interventions, model/call/email costs, and exception-handling effort. Insurer payment to a provider is not automatically patient savings or a patient refund.

## Service providers

Naïve runs company agents and isolated case advocates. Neon provides backend services and persistence. AgentPhone handles requested voice calls, AgentMail handles email, and Vercel hosts the frontend. Twilio Verify supplies phone sign-in codes. Stripe is restricted to test-mode finance tools. Provider configuration and verified availability are documented in [implementation status](implementation-status.md) and the individual integration documents.

The primary entry point is a verified phone number and an explicit “Verify and call me” request. After verification, one durably reserved AgentPhone onboarding call gathers account and case information. Sufficient owner-bound intake creates a case and queues its isolated Naïve advocate. Customers continue through website chat and uploads without an email requirement. Existing email accounts remain supported. Feature gates and verification evidence are documented in [phone onboarding](phone-onboarding.md).

The team's manual end-to-end UI testing validated this customer workflow.
