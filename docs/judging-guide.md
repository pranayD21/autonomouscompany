# Assurance judging guide

Assurance runs insurance claim administration for injured people and policyholders. Workplace-injury claims and health-insurance disputes have separate workflows; each client has an isolated advocate. Start at [assurance.claims](https://assurance.claims), then use the evidence below to assess what the company delivered.

The [official event page](https://events.ycombinator.com/naive-autonomous-companies-hackathon), checked November 8, 2026, asks teams to use the Naïve SDK and show actual delivery, agent decisions, human interventions, and how much runs without humans. It names Unicorn, People's Choice, and Mobile Automation categories, plus design and scaling recognition. It publishes no numeric judging rubric. This guide is an evidence map, not an official scorecard.

## Two-to-four-minute presentation path

Use prepared material only; do not submit cases or trigger fresh calls, OTPs, uploads, models, or external actions.

1. **Problem (30 seconds):** Explain claim administration: gathering evidence, answering insurer requests, and following a claim. Distinguish workplace injury from a health-insurance dispute.
2. **Customer view (40 seconds):** Show a prepared capture from the existing [isolated mock UI](claim-chat-design.md#verification), labeled synthetic, or an already-authorized, redacted record. Point to conversation, evidence, and stop controls; follow the [walkthrough rules](demo-and-research.md#showing-the-product).
3. **Decision and result (40 seconds):** Show the [recorded hosted zero-contact Naïve fixture](implementation-status.md#current-system): question → owner answer → sourced fact in one continuing session, then revocation and remote cancellation. This is fixture evidence. The [real phone case](verification.md#real-user-run) establishes no insurer contact, claim outcome, or proven response to the 12:23 answer before 12:50.
4. **Company and repair (40 seconds):** Point to [Naïve SDK declarations](../naive.config.ts). Distinguish six configured roles from [observed CEO allocation, Front Desk hiring, and advocate startup](implementation-status.md#current-system). Acknowledge [manual inbox reassignment and staffing, approval, and delivery repairs](verification.md#real-user-run).
5. **Economics (30 seconds):** State the [cost/revenue scope](#acquisition-delivery-and-economics): $250 is an allocation ceiling, cost attribution is partial, and Stripe fees are test-only with zero real revenue. Claim no savings, testimonial, insurer response, or acquisition trace beyond the cited evidence.

## Company workflow and Naïve use

The customer requests phone verification and a call. Twilio Verify authenticates the number; one durably reserved AgentPhone onboarding call captures the account and handling scope. Sufficient owner-bound intake creates a case. Customers continue through website chat and document uploads. See [phone onboarding](phone-onboarding.md).

Six permanent Naïve roles are declared for company operations. Their configured mandates cover resource allocation (CEO), case staffing (Front Desk), evidence review (Reviewer), a de-identified playbook (Knowledge), acquisition (Growth), and costs and test fees (Finance). The configured case workflow has Front Desk hire one case-bound Naïve advocate, which persists its goal, asks for missing evidence, researches, chooses authorized actions and follow-up timing, and resumes in the same session. The dated records below identify observed execution. See [company roles](firm-blueprint.md) and [runtime](firm-runtime.md).

SDK use is concrete: [naive.config.ts](../naive.config.ts) imports `defineProject` from `@usenaive-sdk/blueprints` and declares agents, identities, vaults, skills, and schedules. [Role declarations](../backend/firm-blueprint.ts) define the CEO coordinator/team and role-scoped tools. [Runtime setup](../scripts/configure-assurance-firm.ts) reconciles provider resources, including the explicit harness selection described in the [blueprint](firm-blueprint.md). These declarations describe operation; dated verification establishes execution.

## Actual accomplishments and their evidence

| Evidence | What it establishes |
| --- | --- |
| Team-reported real-user production run, November 8 | Naïve advocate staffing and website conversation after engineering repairs. The advocate asked a question at 12:18 UTC; the owner answered at 12:23; a message was recorded at 12:36, but the later investigation says the owner answer reached the advocate at 12:50. The 12:36 message is not proof of a response to that answer. This case was restricted to the owner's inbox, with no insurer contact or claim outcome. [Corrected timeline and interventions](verification.md#real-user-run). |
| Hosted zero-contact fixture | Budget allocation, advocate hiring, session start, first saved goal, and onboarding completion; another fixture exercised question → owner answer → sourced fact, followed by revocation and remote cancellation. [Implementation status](implementation-status.md). |
| Historical hosted direct-model checks | One authorized fictional email arrived in the recipient's Gmail inbox; cross-owner access was denied. Attribute these to the earlier engine, not a Naïve insurer outcome. [Implementation status](implementation-status.md). |
| Scripted full insurer exchange | The historical direct runner's real service/MCP/database code handled first contact, incoming reply, follow-up, sourced simulated outcome, and stop using a scripted model, fictional data, and fake communications. This is separate from live Naïve business evidence. [Verification](verification.md#what-the-automated-tests-prove). |
| Recorded automated validation | The earlier recorded result is 65 files discovered by `npm test` passing, plus TypeScript; a CI pass on `abc1a19` is recorded without a workflow receipt here. The independent checkout evaluation passed build and 29 test files, skipping 36 database files. Test discovery excludes TSX and nested files. [Verification and scope](verification.md#recorded-full-suite-result). |

Private transcripts and case contents stay outside the repository. Production summaries above are attributed to the team's records, not an independent audit.

## Decisions and human involvement

Agents choose case goals, questions, sources, routine actions, and timing within authority. The CEO supplies a case allocation and rationale; Front Desk hires; the advocate records its work. Completion checks require a bound session and saved first goal: an ended model turn alone cannot mark onboarding successful. See [runtime](firm-runtime.md) and [business-result checks](../backend/firm-runner.ts).

Humans supplied the account, handling scope, documents, and chat answers. Engineers also repaired staffing and approval faults during the real-user run. The [change log](change-log.md) records an AgentMail inbox-capacity failure, manual reassignment of an unused fictional-case inbox, the subsequent shared-inbox design, and slow tool approvals. These interventions belong in the delivery account. The recorded exchange establishes continuing agent work with owner input; it does not establish an unattended claim resolution or a measured autonomy percentage.

Revocation, case isolation, source attribution, and duplicate-send protections remain enforced. The current owner-inbox outreach restriction takes precedence over general handling scope. Legacy direct-model runs retain their history without granting a second engine concurrent case authority. See [repository rules](../agents.md) and [workflow migration](persistent-workflow-migration.md).

## Acquisition, delivery, and economics

The owner reports that a Naïve GTM agent found the first user on Reddit. The repository stores that report, not the original outreach receipt. Current Growth tools support discovery, qualification, and draft recording; no Reddit posting tool is configured in the recorded change. Growth instructions require evidence for claimed contact or sign-up, but the record tool accepts those states without a mandatory receipt. The report and stored states do not establish a measured conversion funnel. See [verification](verification.md#first-user), [Growth change](change-log.md#2026-11-08--growth-runs-the-agentic-go-to-market-workflow), and [role source](../backend/firm-blueprint.ts).

Delivered service evidence includes intake, case staffing, owner questions, and website continuation. Insurer decisions, liability reductions, benefits, and received refunds are separate outcome categories; a simulated exchange or bill mismatch is not money saved. See [product](product.md) and [outcome records](outcomes.md).

Finance can calculate a hypothetical fee from a current supported outcome and a supplied rate. Its [implementation](../backend/firm-finance.ts) accepts only test keys and unconfirmed Stripe test PaymentIntents, retaining `paid:false` and zero real revenue. Recorded sandbox verification was read-only and created no PaymentIntent. The CEO's $250 per-case mandate is an allocation ceiling, not observed spend or unit cost. The cost tool reads advocate-session consumption; company-role sessions, voice, email, infrastructure, and human recovery are not aggregated by that implementation. The cited evidence supplies no measured acquisition cost, margin, or paid revenue. See [payments](payments.md) and [case budgets](firm-runtime.md).

## Evidence by prize category

The company roles and persistent case workflow support assessment of the overall autonomous-company entry. Unicorn and scaling assessment can use the resource allocation, isolation, and recovery design, while distinguishing those capabilities from measured adoption, profitability, or concurrent production case volume. People's Choice and design assessment can use the phone-to-chat customer experience and [documented interface decisions](claim-chat-design.md); recorded team walkthroughs and mocked UI checks retain their original attribution.

The Mobile Automation track describes agents operating mobile phones and apps. Assurance's responsive website, requested voice calls, and iPhone home-screen installation establish different capabilities. The evidence linked here contains no qualifying device-action trace, so those features should not be presented as agent-driven mobile automation. These mappings describe evidence for consideration, not eligibility determinations or award predictions.
