# Hosted frontend

**Offline since November 8, 2026.** The hackathon ended and the owner took the public site down. `vercel.json` now deploys only `offline/index.html` ("Assurance is offline.", `noindex`, no app JavaScript) and rewrites every path to it, so https://assurance.claims and https://assurance-claims.vercel.app no longer load the app. To restore the app, revert `vercel.json` to `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist` and push to `main`. The Neon Functions and their schedules are a separate deployment; see the change log for their state.

While it was online, Assurance was served at https://assurance.claims, with https://assurance-claims.vercel.app retained as the fallback. The React/Vite frontend uses the existing Neon production branch for Auth, cases, documents, Realtime, and agent work. Vercel is connected to `pranayD21/autonomouscompany`; pushes to `main` automatically deploy the frontend. Neon migrations, Function code, and backend secrets require a separate deployment first.

`vercel.json` selects `npm run build` and `dist`. Only these public locations belong in frontend configuration:

- `VITE_NEON_AUTH_URL`
- `VITE_NEON_REALTIME_URL`
- `VITE_CASES_API_URL`

`vite.config.ts` validates those URLs, supports local Neon environment fallback, and otherwise uses the public production locations so a build needs no private files. Provider keys, database URLs, and auth secrets are never Vite variables. `.vercelignore` excludes private environment, CLI metadata, local build/test artifacts, and `test-results/` from manual uploads; Git ignores the same private state. Preserve exact Auth, Realtime, and API origin allowlists for both hosted domains and local development.

Release record for `d4f535e`: public HTML returned HTTP 200 with `assets/index-iqqqwjLX.js`, matching the local build. Hosted email E2E passed authentication, older-email fallback, persistence, Realtime, owner isolation, deletion, and sign-out/sign-in. Hosted fictional phone UI checks passed stable identity and two-account isolation. The one authorized real SMS code verified and opened the hosted dashboard. See [implementation-status.md](implementation-status.md) for direct-agent and communication proof.

Run `E2E_BASE_URL=https://assurance.claims/#workspace npm run test:e2e` for fresh fictional email accounts. `npx tsx scripts/hosted-phone-smoke.ts demo` checks the public fictional phone accounts without sending SMS. Real-send commands require their private journal and fresh explicit scope; do not repeat completed test attempts. `scripts/hosted-direct-smoke.ts` observes the deployed scheduler rather than starting a local worker.

The domain was purchased for one year with auto-renew disabled. No hosting plan or additional domain purchase was made with this release.
