# Running Assurance

The hosted service is at https://assurance.claims. Use the steps below to build the client, run the tests, or deploy your own backend. Node 24 and npm are the versions used by CI.

## Run the web client

No private files are needed.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:4173, using `localhost` so the origin matches the deployed API and Realtime configuration.

`vite.config.ts` includes the public production Auth, Realtime, and cases API locations, which are already visible in the deployed client bundle. **A local client therefore talks to the production backend.** Enter only fictional details when trying it. To use another backend, set `VITE_NEON_AUTH_URL`, `VITE_NEON_REALTIME_URL`, and `VITE_CASES_API_URL`.

Building the client does not start a customer workflow. Interacting with it can: phone verification, requested onboarding calls, case submission, and uploads can invoke live providers or queue agents even when the entered story is fictional. `npm run test:e2e` also exercises hosted services and is not an offline test.

For a mocked claim-workspace walkthrough, the existing [claim-page fixture](claim-chat-design.md#verification) uses fictional data and rejects unexpected fetch origins. Its separate entry point is:

```sh
VITE_NEON_AUTH_URL=https://auth.example.invalid VITE_NEON_REALTIME_URL=https://realtime.example.invalid VITE_CASES_API_URL=https://cases.example.invalid npx tsx scripts/claim-page-fixture.ts
```

Use the local fixture URL printed by the script and stop it with Ctrl+C. These placeholder endpoints keep the fixture separate from production; its displayed actions and amounts are synthetic UI evidence.

## Run the tests

```sh
npx playwright install chromium   # two PDF suites render test files with it
createdb assurance_test           # or any disposable Postgres database
OUTREACH_TEST_DATABASE_URL=postgres://localhost/assurance_test npm test
```

`npm test` runs `scripts/run-tests.ts`, which executes each `scripts/*.test.ts` file in turn because database suites share one database. Pass part of a filename to run fewer files, as in `npm test -- firm-runner`. Suites migrate the database themselves, so never point them at production.

Discovery is limited to top-level files ending in `.test.ts`. The runner does not include `.test.tsx` files or nested directories. For example, run the composer checks separately with `npx tsx --test scripts/claim-composer.test.tsx`. UI fixture and live smoke scripts are separate checks; read their topic documentation before invoking them, because some use deployed services. A green `npm test` result describes the files discovered by this runner, not every check stored in the repository.

Without `OUTREACH_TEST_DATABASE_URL`, database suites are skipped and listed. CI refuses to skip them. `.github/workflows/ci.yml` runs the build and tests on pushes to `main` and on pull requests, using a Postgres service.

See [verification](verification.md) for what these tests prove and the most recent results.

`npm run typecheck` checks types. `npm run format:check` and `npm run format` use Prettier; the existing code has not yet been reformatted, so CI does not enforce formatting.

## Run your own backend

The full service needs your own accounts. Copy `.env.example` to `.env.local`, which is ignored by git, and fill it in. The file lists variable names only.

| Service | Purpose | Main variables |
| --- | --- | --- |
| Neon | Database, Auth, Functions, Realtime, storage | `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_REALTIME_URL`, `AWS_*` |
| Naïve | Company roles and case advocates | `NAIVE_API_KEY`, `ASSURANCE_FIRM_*` |
| Twilio Verify | Phone sign-in codes | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| AgentPhone | Onboarding calls | `AGENTPHONE_API_KEY`, `AGENTPHONE_AGENT_ID`, `AGENTPHONE_NUMBER_ID` |
| AgentMail | Third-party email | `AGENTMAIL_API_KEY`, `AGENTMAIL_PUBLIC_INBOX_ID`, `AGENTMAIL_WEBHOOK_SECRET` |
| OpenAI | Document reading and case titles | `OPENAI_API_KEY` |

Then:

```sh
npm run db:migrate      # apply drizzle/ migrations
npm run stack:check     # exits nonzero for missing or blocked services
npm run stack:plan      # dry run of the Naïve resources
npx tsx scripts/configure-assurance-firm.ts   # read-only plan; --apply reconciles roles
```

Deploy the Functions declared in `neon.ts` as described in [Neon operations](neon.md). Features sit behind these switches, which default to off in `neon.ts`:

- `ASSURANCE_FIRM_ENABLED=true` runs the agent company.
- `ASSURANCE_CASE_ENGINE=naive` selects Naïve advocates on every Function.
- `PHONE_ONBOARDING_ENABLED=true` turns on the "Verify and call me" path.
- `OUTREACH_RESTRICT_TO_ALLOWLIST=true` limits outside contact to `OUTREACH_ALLOWED_EMAILS` and `OUTREACH_ALLOWED_PHONES`. Use it for any testing that must not reach real insurers.

Commands that start agents, send email, or place calls can spend money and contact real people. Read [stack operations](stack.md) before running them.
