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

## Review-only permission UI published

Deployment `dpl_CtEPHTMqgKq2SCy59QXppS1mHTNC` is Ready and aliased to https://assurance.claims. Hosted E2E passed fresh signup/sign-in, authenticated provider readiness, Realtime, case persistence/deletion, and cross-user isolation. The explicit mocked authorization UI check verified review-only sends zero contacts/zero outbound allowance, email retains its limits, and switching permission clears consent; it did not create a live grant.

The one-hour project-scoped token authorizes deployments only; its expiry does not expire the website. It was revoked after publication (HTTP 200), subsequent project access returned 403, and its local secret file was deleted. A browser snapshot briefly included the token before revocation; it is no longer usable. The browser setup tab was closed. Gateway inference remains unavailable because no model is enabled.

## Latest committed landing/workspace deployment

Published clean commit `c3cf6fdc4330fe5bb6442e70d2ecd2c8c978cd09` to Vercel deployment `dpl_DFXTP6ik13ss4psM2qYv9Wjdu1tm`, Ready and aliased to https://assurance.claims. The deployment source came from `git archive` under ignored `test-results/deploy-c3cf6fd`; unfinished approval UI/API/schema edits were excluded. Only the three public service URLs were supplied for the local frontend build; private environment files and test artifacts were excluded by `.vercelignore`. Build passed. Live HTML and JavaScript returned HTTP 200; `/assets/index-CyFcGUXZ.js` matches the clean commit build. The terminal-session backend fix was already deployed to Neon according to the commit's verification record; no backend redeployment was needed.

The first committed E2E attempt stopped at its obsolete root sign-in assumption because `/` now serves the landing page. A rerun uses `https://assurance.claims/#workspace`. This is a test-entry correction, not a production code change. The corrected run passed real signup, authenticated Function access, Realtime, case creation, and reload persistence. Its optional mocked permission fixture then timed out during session loading; this fixture check did not pass. A core rerun passed provider readiness, authorization denial, cross-user isolation, and case deletion after correcting the ignored test copy to the new Delete case label. Its final sign-out assertion still assumed sign-out returns to the form; production correctly returns to the landing page. A separate direct smoke passed the actual landing → workspace → signup → sign-out → workspace → password sign-in → sign-out flow. Thus the unmodified committed E2E suite is not reported as passing; the relevant hosted behaviors were verified with corrected entry/navigation expectations.

The one-hour project-scoped deployment token was revoked (HTTP 200), subsequent project access was denied (403), its local file was deleted, and the setup tab was closed. No token value was printed.

After the approval backend deployment, the updated repository E2E passed against https://assurance.claims with exit code 0, including the corrected landing/sign-out navigation and cross-user denial on both approval routes. This later run supersedes the old suite navigation failures above. The optional mocked fixture was not enabled, and the approval UI remains unpublished. Gateway inference remains unavailable with no enabled model.

## Approval UI release

Published commit `5b37141` as production deployment `dpl_BLKVRRBirHEN3hY5Ee81Y7WZbaB8`, Ready and aliased to https://assurance.claims. Build passed (273 modules); live HTML and `/assets/index-sFJT95aR.js` returned 200 and matched the local build. The approval backend was already deployed.

`E2E_BASE_URL=https://assurance.claims E2E_AUTHORIZATION_UI=1 npm run test:e2e` exited 0. Real auth, Functions, persistence, Realtime, readiness, cross-user isolation, deletion, sign-out, and password sign-in passed. The optional mocked permission fixture now also passed, including review-only scope, consent reset on scope changes, and exact one-action approval payload. Mocked requests did not authorize a live grant or confirm a real provider action. Gateway inference remains unavailable with no enabled model.

The one-hour Assurance-only token was revoked through Vercel; subsequent project access returned 403. Its private file was removed and the deployment tab closed. Website hosting persists after token revocation.

## Redeploy requested after live approval verification

Published clean commit `baf3548` as production deployment `dpl_FESJmoN6a5T8G7F9c2FTwA7btaM2`, Ready and aliased to https://assurance.claims. Ongoing activation changes in the shared workspace were excluded using a clean `git archive` in ignored `test-results/redeploy-baf3548`. Build passed. Live HTML and `/assets/index-sFJT95aR.js` returned 200; the asset matches the clean commit build. No Neon deployment or schema change was performed.

Vercel required a fresh email verification before issuing the Assurance-only one-hour token. A diagnostic accidentally included that temporary token; it was revoked after deployment (HTTP 200), subsequent access was rejected (403), and its private local file and OTP copy were removed. The setup tab was closed. Hosted E2E with E2E_AUTHORIZATION_UI=1 exited 0: real Auth, database persistence, Realtime, provider readiness, owner/cross-user access controls, case deletion, sign-out, and password sign-in passed. Mocked authorization and exact pending-action UI controls passed without creating a real grant or sending a provider confirmation. The optional disabled gateway inference remains out of scope.
