# Hosted frontend

Assurance is a React/Vite frontend backed by the existing Neon production branch. Hosting setup uses the operator's existing Vercel Hobby account. This is a synthetic hackathon prototype; no hosting subscription or domain purchase is part of this setup.

`vercel.json` selects Vite, `npm run build`, and the `dist` output directory. The frontend build needs only these public locations:

- `VITE_NEON_AUTH_URL`: the Neon Auth base URL.
- `VITE_NEON_REALTIME_URL`: the Realtime endpoint.
- `VITE_CASES_API_URL`: the deployed cases Function origin.

`vite.config.ts` accepts those values in hosted builds and retains the local Neon env fallback. It rejects missing or invalid public locations. Never upload `.env.local`, database connection strings, provider keys, or a Realtime signing secret to the frontend host. `.vercel/` is ignored so local CLI metadata cannot be committed accidentally. `.vercelignore` separately excludes env files, Neon/CLI metadata, local builds, and `test-results`; the Vercel upload dry run did not honor the repository Git exclusions on its own. Inspect `vercel deploy --dry --json` before direct uploads.

Before the hosted app is usable, add its exact HTTPS origin to Neon Auth trusted domains, Realtime allowed origins, and the cases Function's `APP_ORIGINS`. Preserve the localhost origins. Do not allow all `vercel.app` domains or arbitrary preview deployments.

Vercel deployment `dpl_9usoC122DDM48psWMX5LtKSmi6Bk` built successfully and is assigned to https://assurance-claims.vercel.app. The exact origin is allowed by Neon Auth, API CORS, and Realtime, with both localhost origins preserved. Hosted E2E passed signup, password sign-in, session restoration, case persistence, live updates, cross-user denial, and sign-out. Gateway inference remains blocked by credits. A successful Vercel build alone does not establish working Auth, case ownership, or Realtime. See the change log for observed results.

The existing Vercel GitHub import returned bad-credential/repository-not-found errors. Direct CLI deployment uses a one-hour team-scoped token created after operator email verification; the token was kept privately and revoked after verification. The local Vercel link adds an ignored OIDC token while preserving the existing Neon/provider env values. This deployment is not yet connected to automatic GitHub builds.

Run `E2E_BASE_URL=https://assurance-claims.vercel.app npm run test:e2e` to exercise the deployed frontend with fresh synthetic users. Without that variable, the same suite uses localhost. It covers signup, password sign-in after sign-out, session restoration, persistence, live updates, owner isolation, spending denial, and the known unavailable Gateway response.

The three public URLs are persisted as Production configuration on Vercel for future builds. The app remains a synthetic prototype, and new signups cannot spend agent credits or authorize outreach until the operator configures their user ID. No paid plan was purchased. GitHub auto-deployment remains unconnected; deployment currently uses the Vercel CLI.

## First operator access

The setup account at the providers is separate from an Assurance login. The operator created an Assurance account through the hosted app after the initial lookup found none. Do not reuse provider passwords or fabricate an Auth user/session to bypass signup.

After signup, confirm the intended account with the operator and inspect its actual `neon_auth.user` record. An email match alone is insufficient when `emailVerified` is false. For this setup, the operator confirmed creating the account and the signed-in Dia session returned the same exact user ID from the protected `/session` endpoint. Email verification itself remains false and was not modified. Establish ownership before adding the exact ID to `CREW_ALLOWED_USER_IDS`. Preserve any existing IDs, keep the approved agent budgets unchanged, and deploy the cases Function. Verify `/stack/status` from that user's authenticated session and confirm another user remains denied. Persist the allowlist in the private deployment environment so a later `neon deploy` does not remove access.

Operator access also permits document reading and outreach authorization in the app. Recipient allowlists and explicit approval for a particular external message or call still apply. Enabling crew access does not authorize a test call or email.
