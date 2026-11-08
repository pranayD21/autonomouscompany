# Hosted frontend

Assurance is a React/Vite frontend backed by the existing Neon production branch. Hosting setup uses the operator's existing Vercel Hobby account. This is a synthetic hackathon prototype; no hosting subscription or domain purchase is part of this setup.

`vercel.json` selects Vite, `npm run build`, and the `dist` output directory. The frontend build needs only these public locations:

- `VITE_NEON_AUTH_URL`: the Neon Auth base URL.
- `VITE_NEON_REALTIME_URL`: the Realtime endpoint.
- `VITE_CASES_API_URL`: the deployed cases Function origin.

`vite.config.ts` accepts those values in hosted builds and retains the local Neon env fallback. It rejects missing or invalid public locations. Never upload `.env.local`, database connection strings, provider keys, or a Realtime signing secret to the frontend host. `.vercel/` is ignored so local CLI metadata cannot be committed accidentally.

Before the hosted app is usable, add its exact HTTPS origin to Neon Auth trusted domains, Realtime allowed origins, and the cases Function's `APP_ORIGINS`. Preserve the localhost origins. Do not allow all `vercel.app` domains or arbitrary preview deployments.

Deployment and hosted end-to-end verification are in progress. A successful Vercel build alone does not establish working Auth, case ownership, or Realtime. See the change log for observed results.
