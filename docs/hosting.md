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

Run `E2E_BASE_URL=https://assurance.claims npm run test:e2e` to exercise the deployed frontend with fresh synthetic users. Without that variable, the same suite uses localhost. It covers signup, password sign-in after sign-out, session restoration, persistence, live updates, owner isolation, spending denial, and the known unavailable Gateway response.

The three public URLs are persisted as Production configuration on Vercel for future builds. The app remains a synthetic prototype, and new signups cannot spend agent credits or authorize outreach until the operator configures their user ID. No paid plan was purchased. GitHub auto-deployment remains unconnected; deployment currently uses the Vercel CLI.

## First operator access

The setup account at the providers is separate from an Assurance login. The operator created an Assurance account through the hosted app after the initial lookup found none. Do not reuse provider passwords or fabricate an Auth user/session to bypass signup.

After signup, confirm the intended account with the operator and inspect its actual `neon_auth.user` record. An email match alone is insufficient when `emailVerified` is false. For this setup, the operator confirmed creating the account and the signed-in Dia session returned the same exact user ID from the protected `/session` endpoint. Email verification itself remains false and was not modified. Establish ownership before adding the exact ID to `CREW_ALLOWED_USER_IDS`. Preserve any existing IDs, keep the approved agent budgets unchanged, and deploy the cases Function. Verify `/stack/status` from that user's authenticated session and confirm another user remains denied. Persist the allowlist in the private deployment environment so a later `neon deploy` does not remove access.

Operator access also permits document reading and outreach authorization in the app. Recipient allowlists and explicit approval for a particular external message or call still apply. Enabling crew access does not authorize a test call or email.

The autonomy frontend was deployed after a new one-hour, project-scoped token was created with user verification. That token has since been revoked. Use the verified custom-domain deployment described below for current status.


## Autonomy frontend and requested domain

Deployment `dpl_RCHemF8YzFYwPy2SgmxLP3CqySZ1` is ready at the existing production URL. Hosted E2E passed, including owner access to autonomy history, denial of autonomous authorization for unlisted signups, and cross-user denial of history/authorization/revocation. The operator's signed-in workspace displays the new authorization form and stop control. A one-hour, project-scoped Vercel token was created after user verification and was revoked after deployment and domain configuration; its private local file was removed.

The user requested `assurance.claims` from Porkbun and approved the one-year option. The cart shows $10.81 for registration and an estimated $58.19 yearly renewal, with no paid add-ons. Porkbun confirmed registration after the operator completed checkout in Dia. The domain expires 2027-11-08. Domain auto-renew was disabled to keep this to the requested one-year purchase. Keep the existing Vercel URL working until ownership, DNS, HTTPS, exact Auth trusted origin, API CORS, and Realtime origins are verified for the new domain.


Porkbun DNS now has an apex A record `216.198.79.1` and a `www` CNAME `4240de8c1c5841a9.vercel-dns-017.com`, both TTL 600. These replace the new domain's default parking records. Vercel connects the apex to Production and redirects `www` to the apex with HTTP 308. The CLI domain-add command failed with `User not found`; the signed-in Vercel UI completed the assignment instead. Neon Auth trusts `https://assurance.claims`, and `neon.ts` includes that exact origin for API CORS and Realtime while preserving existing origins. The updated backend policy was deployed. Public DNS still returned NXDOMAIN at the last check; HTTPS and full E2E on the new domain remain unverified.

Authoritative DNS diagnosis: `curitiba.ns.porkbun.com` returns the configured apex A and www CNAME records. The `.claims` registry server `v0n1.nic.claims` still returned NXDOMAIN for the new delegation. This locates the current delay at registry publication rather than the saved Porkbun record values. Do not claim the public hostname is live until recursive DNS and HTTPS succeed.


## Verified custom domain

The registry delegation is now published. Google and Cloudflare recursive DNS return `216.198.79.1`; Vercel reports Valid Configuration and issued HTTPS certificates. The apex returns HTTP 200 with certificate verification enabled. Full hosted E2E passed on `https://assurance.claims`, including signup, password sign-in, session restoration, case persistence, Realtime, autonomy access restrictions, cross-user isolation, deletion, and sign-out. The test used Chromium's host resolver mapping to the publicly resolved IP because the local OS retained a negative DNS cache; it did not disable TLS verification or change the application origin. The separate Gateway inference check still reports no enabled model.

`www.assurance.claims` returns HTTP 308 to the apex. The old Vercel hostname also returns HTTP 308 to the apex, verified at its public edge. The temporary deployment token was revoked. The new canonical app address is `https://assurance.claims`.

## Local DNS failure resolved

The operator’s Mac/Dia could not resolve assurance.claims while Cloudflare, Google, Quad9, and the ISP resolver returned the correct Vercel address. The active Tailscale resolver returned cached NXDOMAIN. Public HTTPS returned 200 with a valid certificate when directed to the resolved address. With explicit operator approval, added `/etc/resolver/assurance.claims` on this Mac containing Cloudflare nameservers 1.1.1.1 and 1.0.0.1, preserving other DNS and Tailscale settings, then flushed the Mac DNS cache. This is a local machine change, not repository or public DNS configuration. Removing that single resolver file reverses it.

Verified the file has two proper nameserver lines, normal system resolution returns 216.198.79.1, ordinary HTTPS returns 200 without overrides, and Dia renders the sign-in form. `E2E_BASE_URL=https://assurance.claims npm run test:e2e` passed signup, sign-in, persistence, realtime, isolation, deletion, and sign-out using normal DNS. Gateway inference remains unavailable; its unavailable UI was verified, not successful inference.

## Public fallback while new-domain DNS caches expire

A second computer reported DNS_PROBE_FINISHED_NXDOMAIN. Cloudflare and Google still returned the correct apex A record; Quad9 returned the Porkbun delegation, and no conflicting DS record was present. Restored assurance-claims.vercel.app as a Production domain instead of redirecting it to assurance.claims. Vercel reports both as Valid Configuration / Production; unauthenticated HTTPS on the fallback returns 200. Existing Auth/CORS/Realtime origins already allow this hostname. The apex stays canonical, and www continues to redirect to it. The second computer’s resolver remains uninspected; negative caching is a diagnosis supported by public checks, not proof that its local problem is fixed.

## Provider-neutral frontend deployed

Deployment dpl_HRzhB97ZCHSVepdi4maaJQQjFtyQ is Ready on production. The upload dry run excluded env files, local Neon/Vercel metadata, and test artifacts. Hosted E2E passed normal-domain signup/sign-in, case persistence, realtime, isolation, autonomy authorization denial for unlisted users, and sign-out. Gateway inference remains unavailable. Both temporary deployment access tokens were revoked in Vercel and their rows disappeared. GitHub automatic deployment remains unconnected.


## Outcome UI awaiting frontend deployment

The owner-only outcome API is deployed on Neon. The outcome panel builds and passed local browser checks against that backend, including synthetic populated-state rendering and real API isolation. Vercel CLI reports logged out; no production frontend deployment has been made for this change. A temporary deployment token was requested privately. The existing production UI remains in place.


The supplied replacement deployment token was rejected with HTTP 403 Not authorized by both read-only user/project access checks and deployment. No frontend change reached production. Another private token request is pending; no secret value was logged.


## Outcomes and session status published

Deployment dpl_B2grMLravUcMQWyucSQDavtzsg6M is Ready and aliased to https://assurance.claims. Hosted E2E passed signup/sign-in, persistence, Realtime, owner outcome/session-history access, cross-user denial, and explicit synthetic UI fixtures for outcome amounts, stale evidence, unknown refunds, supporting quotes, session status, and human-help questions. AI Gateway inference remains unavailable. The temporary deployment token was revoked successfully and subsequent project access returned 403; its private file and the earlier rejected token file were removed. This supersedes the pending-publication entries above.

The hosted E2E test also reads authenticated `/stack/status`: it requires AgentPhone as the call provider, configured call/email transports, and disabled spending for the fresh unlisted test user. This is configuration/readiness evidence, not a live call or email dispatch test.
