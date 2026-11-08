<img src="assets/icon.svg" width="64" height="64" alt="">

# Assurance

Assurance is an agent-run insurance claims advocacy service. It helps injured people and policyholders organize evidence, manage workplace-injury claims and health-insurance disputes, communicate with insurers and claims administrators, and follow up on documented decisions. Each case has an isolated advocate, owner-controlled authorization, and durable records of actions and evidence.

## How it works

1. A customer enters a phone number and asks Assurance to verify it and call them.
2. An onboarding call collects the account of what happened and the standard handling scope.
3. The transcript creates the case and starts its own Naïve advocate.
4. The customer continues in website chat and uploads documents there.
5. The advocate researches the claim, contacts the insurer or claims administrator, follows up, and reports back on the website.

The team has tested this journey end to end through manual UI workflows. See [implementation status](docs/implementation-status.md) for recorded verification.

Start with [agents.md](agents.md) and the [documentation index](docs/README.md). Every repository change must update the relevant Markdown in `docs/`.

## Run locally

```sh
npm ci
# Restore your team's private .env.local; .env.example lists variable names only.
npm run build
npm start
```

Open http://localhost:4173. Use localhost so the origin matches the deployed API and Realtime configuration. Existing email/password accounts remain supported. Use fictional records for local verification. Legacy crew review runs require the user's Neon Auth ID in `CREW_ALLOWED_USER_IDS` and a Function redeploy.

```sh
npm run stack:check
npx playwright install chromium
npm run test:e2e
npm run stack:plan
```

`stack:check` exits nonzero for missing or blocked services. The E2E script checks the Neon flow and the explicit gateway-unavailable state; it does not exercise AI inference. `npm run test:crew` spends capped Naïve credits on its first run, then checks the same session. Read [stack operations](docs/stack.md) before provisioning agents or placing calls.

No real medical documents, credentials, call recordings, or private patient information belong in this repository.
