# Assurance: your case, handled

Assurance gives injured people and policyholders an advocate who keeps their insurance claim moving. Start with a phone number and tell us what happened. Your dedicated agent organizes the evidence, researches the claim, handles authorized insurer communication, and follows up as the case develops.

Getting help with insurance should not require becoming an insurance expert. We built Assurance so people can start with what they know and have an advocate work through the next steps.

Assurance is live at [assurance.claims](https://assurance.claims). The team has tested the customer journey with a real user on production, and a Naïve GTM agent found our first user through Reddit. Our GTM scrapers surfaced **300 high-signal prospect posts across GoFundMe, X, and Reddit in under two hours**, examining complaints from the preceding three days, according to the team's November 8 report. We have a concrete pool of expressed need to work from, with people describing the problems they need help solving now.

## The gaps we are closing

An insurance claim can leave the person seeking help responsible for understanding a decision, finding documents, identifying the right organization, explaining what happened, and following up. Assurance takes on that administrative work through a continuing relationship with one case advocate.

**The knowledge gap.** Knowing that something went wrong is different from knowing what to do next. Our advocates read the supplied evidence, research relevant public guidance, ask for missing facts, and choose the next supported action. Workplace injuries and health-insurance disputes follow distinct paths because their procedures and parties differ. Customers can begin with an incomplete account and add information as the case develops.

**The savings gap.** Turning available coverage into an actual financial result takes forms, evidence requests, follow-ups, and resolution of disputed responsibility. Assurance handles those administrative steps and records the eventual decision and amounts with supporting evidence. Customers can see what changed financially because we track reductions in patient responsibility separately from insurer decisions and refunds received. Our objective is to help people obtain the coverage and benefits their evidence supports; successful administration does not guarantee a payout.

**The language barrier.** Assurance is oriented toward serving people in any language, with multilingual models as its foundation. Our aim is for customers to describe what happened and understand the next step in the language they are comfortable using. The advocate connects their account to claim documents, research, and insurer correspondence. We also address the barrier within a language: customers can ask questions in everyday terms and receive explanations of unfamiliar insurance terminology in the same conversation.

People can ask for help before they know the form name, the claims process, or every fact an insurer will eventually request.

## Help that starts with a phone number

The entry point is **Verify and call me**. A customer verifies their number, receives the requested onboarding call, and describes what happened. Sufficient intake from the account-bound transcript creates the case and queues its isolated Naïve advocate. The customer can then continue through website chat and document uploads without an email address.

Customers can add an insurance card, a letter, a bill, or other supporting evidence in the same workspace where they speak with their advocate. Case details and documents remain available alongside activity and outcomes when they want to inspect them. The stop control stays within reach.

Our mobile web app can be added to an iPhone's Home Screen and opened full-screen. It loads the live service, so the same case and conversation are available on desktop and phone. We built mobile navigation, swipe gestures, safe-area spacing, and a case-information bottom sheet around that experience.

The interface includes labeled controls, keyboard navigation, reduced-motion behavior, and primary touch targets of at least 44 pixels. Mobile input text is 16 pixels to avoid focus zoom. We checked layouts with Safari's WebKit engine using iPhone 15, iPhone SE, and iPhone 15 landscape profiles, as recorded in the mobile audit. The goal is a case workflow that remains usable on a small screen, with room to read, respond, and add evidence.

## A company with a team of agents

Naïve runs the company team and the case advocates. Six permanent roles handle the work around each case:

| Role | Work it performs |
| --- | --- |
| CEO | Coordinates company work and allocates case budgets with a recorded rationale. |
| Front Desk | Processes intake and hires the advocate for an authorized case. |
| Case Reviewer | Reviews case evidence and records concrete findings. |
| Knowledge | Maintains reusable playbooks with source attribution and revision history. |
| Growth | Discovers and qualifies public prospects, drafts replies, and records lead progress. |
| Finance | Reports recorded costs and derives test-mode fees from supported outcome records. |

Each case has its own advocate and persistent session, with a dedicated identity and credential. The advocate writes a goal and finish condition, chooses research and follow-up times, requests information, and continues when the customer or a third party responds. It can request help from company roles without receiving their credentials.

When a claimant answers, the advocate continues the existing conversation. Incoming insurer messages become case evidence, and follow-up timers bring the advocate back to the same work. The service can carry a claim through multiple exchanges while retaining its context.

The Knowledge role maintains source-attributed playbooks that exclude private case information. Reviewer findings can wake the relevant advocate. Useful procedures carry forward to another case while each customer's records stay separate.

## Engineering for actions that have consequences

Agent decisions connect to real communication tools and documents, with durable case records to track the work.

- **One requested onboarding call.** The backend reserves the call before dispatch. Reloads and repeated requests reuse its recorded state; an uncertain response does not cause an automatic redial.
- **Persistent work and recovery.** Database events, scheduler leases, stable operation IDs, and provider bindings preserve work across retries and restarts. Earlier direct-model runs retain their engine so two engines do not act on one authority.
- **Source-linked evidence.** Public-source snapshots retain their text, retrieval time, and hash. Citation checks require the quoted text to occur in the stored source. Document extraction and accepted correspondence supply traceable case evidence.
- **Communication with receipts.** AgentMail handles written correspondence and signed webhook ingress. AgentPhone handles new calls. Dispatch records distinguish a confirmed provider receipt from an uncertain attempt.
- **Case-isolated portal work.** The portal integration uses Naïve's browser with an isolated context, owner connection, and durable action records. An uncertain submission requires reconciliation before another attempt.
- **Customer control.** Case tools check current authority and credentials. Revocation stops local work and invalidates access; role permissions constrain what company agents can do.
- **Completion tied to results.** Staffing completes only when the runtime can find the bound advocate session and its initial goal. Outcome records require supporting quotes from accepted case evidence.

Customers can follow the case through their conversation and inspect the records of what their advocate did.

## The accomplishments we can point to

We can point to a real production journey, delivered communications, and repeatable checks of the systems behind them.

| Proof point | What we have established |
| --- | --- |
| 300 high-signal prospect posts | The team reports finding these across GoFundMe, X, and Reddit in under 2 hours, examining the preceding 3 days of public complaints. |
| First user acquired through Reddit | The team reports that a Naïve GTM agent found the first user. |
| 6 permanent company roles | Role-specific identities, credentials, tools, coordination, and operating schedules are implemented. |
| 1 isolated advocate per case | Persistent case sessions preserve goals, evidence, and conversations. |
| 2 claim workflows | Workplace-injury claims and health-insurance disputes have distinct intake and procedural context. |
| 4 supported document formats | Customers can upload PDF, PNG, JPEG, and WebP files. |
| 65 test files passed | A fresh local Postgres run on November 8 passed with 0 failures and 0 skipped files. TypeScript and the production build also passed. |

The production record includes a real onboarding journey, Front Desk staffing, an advocate question, an owner answer in website chat, and continuation in the same advocate session. Other recorded checks established a real SMS sign-in, delivery of one authorized agent email to the recipient's Gmail inbox, and denial of another account's attempts to access a case.

The test suite checks concurrency, authorization, duplicate prevention, recovery, and state transitions against real Postgres. A scripted model and fake communications also exercised a full fictional insurer exchange through first contact, reply, follow-up, outcome recording, and stop. This lets us verify the service logic without contacting an insurer or turning a test result into a customer claim.

## Demand we can reach

Our GTM discovery starts where people are already describing the problem. The 300 high-signal posts span fundraising appeals on GoFundMe and public complaints on X and Reddit. They give us specific problems to understand and prospective customers to qualify. The first reported Reddit acquisition connects that discovery approach to actual product use.

Growth qualifies relevance and records leads by public post URL, keeping track of drafts and contact evidence. That gives us an audience to qualify and serve. Repeat usage and customer outcomes will establish the strength of the business.

We can meet people while they are looking for help, give them a low-effort way to start, and keep an advocate working through the administrative exchanges that follow.

Start at [assurance.claims](https://assurance.claims). Tell us what happened.

## Evidence behind this document

This showcase reflects the product and evidence available on November 8, 2026. The owner reports 300 high-signal prospect posts across GoFundMe, X, and Reddit, found in under two hours from the preceding three days. [Verification](verification.md) records this discovery report and the first-user acquisition. The count measures posts; distinct people, contacted leads, and customer conversions are separate measures. The language-access positioning reflects the product's all-language orientation and multilingual model foundation; it does not assert tested performance in every language across the full workflow.

The separately documented production case was restricted to the owner's designated inbox and records no insurer response or resolved financial outcome. We ran Assurance with Claire, the Reddit user, and deliberately withheld her call records for privacy. The separately delivered email belongs to the earlier hosted direct-model release. [Verification](verification.md) and [implementation status](implementation-status.md) distinguish those records from fictional test exchanges. The 65-file test run and production build were independently rerun during the repository assessment preceding this document.

For implementation details, see [company runtime](firm-runtime.md), [company roles](firm-blueprint.md), [phone onboarding](phone-onboarding.md), [mobile interface](frontend.md), [case conversation](web-chat.md), [source research](research.md), [outcome evidence](outcomes.md), and [portal work](case-portals.md). The mobile app uses the live website in standalone mode. Finance remains restricted to [Stripe test mode](payments.md).

Built by Pranay Dogra, Yuvraj Taneja, Shaunik Musukula, Ishaan Agrawal, and Prashanth Prabhala.
