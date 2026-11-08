<img src="assets/icon.svg" width="64" height="64" alt="">

# Assurance

**Assurance is a fully autonomous, AI-native patient advocacy firm that finds and files your medical insurance claims, then persistently disputes any denial with the insurer itself, so you can recover instead of sitting on hold.**

Assurance is an agent-run insurance claims advocacy service. It helps injured people and policyholders organize evidence, manage workplace-injury claims and health-insurance disputes, communicate with insurers and claims administrators, and follow up on documented decisions. Each case has an isolated advocate, owner-controlled authorization, and durable records of actions and evidence.

Read the [product showcase](docs/product-showcase.md) for the pitch, mobile experience, company agents, and accomplishments behind Assurance.

## How it works

1. A customer enters a phone number and asks Assurance to verify it and call them.
2. An onboarding call collects the account of what happened and the standard handling scope.
3. The transcript creates the case and starts its own Naïve advocate.
4. The customer continues in website chat and uploads documents there.
5. The advocate researches the claim, contacts the insurer or claims administrator, follows up, and reports back on the website.

We ran Assurance with Claire, our first user acquired through Reddit by our Naïve GTM agent, and included short clips of the call in our demo video with her permission. We deliberately withheld the full call logs, recordings, transcripts, and private case details from this public repository to protect her privacy.

Start with [agents.md](agents.md) and the [documentation index](docs/README.md). Every repository change must update the relevant Markdown in `docs/`.

## Run it

Use the live service at https://assurance.claims, or build the client with no private files:

```sh
npm ci
npm run build
npm start
```

Open http://localhost:4173. The local client talks to the production backend, so enter only fictional details.

Run the tests against a disposable Postgres database:

```sh
npx playwright install chromium
OUTREACH_TEST_DATABASE_URL=postgres://localhost/assurance_test npm test
```

[Running Assurance](docs/running.md) covers the tests, required accounts, and deploying your own backend.

No real medical documents, credentials, call recordings, or private patient information belong in this repository.
