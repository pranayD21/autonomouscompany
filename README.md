<img src="assets/icon.svg" width="64" height="64" alt="">

# Bill Advocate

An insurer-facing claims advocacy prototype for the Naïve Autonomous Company Hackathon. Start a synthetic workplace-injury or health-insurance case, add information as it arrives, and ask a budgeted Naïve crew for a claim investigation plan. The selected demo is a chemical burn at work. Authorized outreach has durable records; one case-linked email and a standalone phone test are verified. Full claim submission and resolution are not yet implemented.

Start with [agents.md](agents.md) and the [documentation index](docs/README.md). Every repository change must update the relevant Markdown in `docs/`.

## Run locally

```sh
npm ci
# Restore your team's private .env.local; .env.example lists variable names only.
npm run build
npm start
```

Open http://localhost:4173. Use localhost so the origin matches the deployed API and Realtime configuration. Sign up with an email/password to create synthetic cases. Crew runs require the user's Neon Auth ID in `CREW_ALLOWED_USER_IDS` and a Function redeploy.

```sh
npm run stack:check
npx playwright install chromium
npm run test:e2e
npm run stack:plan
```

`stack:check` exits nonzero for missing or blocked services. The E2E script checks the working Neon flow and the explicit gateway-unavailable state; it does not prove AI inference. `npm run test:crew` spends capped Naïve credits on its first run, then checks the same session. Read [stack operations](docs/stack.md) before provisioning agents or placing calls.

No real medical documents, credentials, call recordings, or private patient information belong in this repository.
