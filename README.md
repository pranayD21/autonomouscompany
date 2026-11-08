<img src="assets/icon.svg" width="64" height="64" alt="">

# Assurance

Assurance is an agent-run insurance claims advocacy service. It helps injured people and policyholders organize evidence, manage workplace-injury claims and health-insurance disputes, communicate with insurers and claims administrators, and follow up on documented decisions. Each case has an isolated advocate, owner-controlled authorization, and durable records of actions and evidence.

## For judges and reviewers

Start with the [judging guide](docs/judging-guide.md) for the company workflow, agent decisions, human interventions, acquisition, delivery, and economics. It links claims to the repository's evidence and source.

- [Verification](docs/verification.md): team-reported production activity, hosted checks, and automated test evidence.
- [Company agents](docs/firm-blueprint.md) and [runtime](docs/firm-runtime.md): six permanent Naïve roles, an isolated advocate per case, durable staffing, and scoped tools.
- [Documentation index](docs/README.md): product, architecture, operations, and integration references.

## How it works

1. A customer enters a phone number and asks Assurance to verify it and call them.
2. An onboarding call collects the account of what happened and the standard handling scope.
3. The transcript creates the case and starts its own Naïve advocate.
4. The customer continues in website chat and uploads documents there.
5. Within the owner's handling scope and active outreach controls, the advocate researches the claim, communicates, follows up, and reports back on the website.

The team reports a real-user production run and first-user acquisition through a Naïve GTM agent on Reddit. The real phone case was restricted to the owner's designated inbox; it records no insurer contact or claim outcome. The full insurer exchange was exercised with a scripted model and fake communications. [Verification](docs/verification.md) distinguishes these records. Finance is [Stripe test-only](docs/payments.md); no paid revenue is claimed.

Start with [agents.md](agents.md) and the [documentation index](docs/README.md). Every repository change must update the relevant Markdown in `docs/`.

## Run it

Use the live service at https://assurance.claims, or build the client with no private files:

```sh
npm ci
npm run build
npm start
```

Open http://localhost:4173. The local client talks to the production backend. Phone verification, requested calls, case submission, and uploads can invoke live services or agents even with fictional input. For a mocked walkthrough, use the [isolated claim-workspace fixture](docs/running.md#run-the-web-client).

Run the tests against a disposable Postgres database:

```sh
npx playwright install chromium
OUTREACH_TEST_DATABASE_URL=postgres://localhost/assurance_test npm test
```

[Running Assurance](docs/running.md) covers the tests, required accounts, and deploying your own backend.

No real medical documents, credentials, call recordings, or private patient information belong in this repository.
