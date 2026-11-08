# Automatic frontend deployments

The existing Vercel project `assurance-claims` is connected to the GitHub repository `pranayD21/autonomouscompany`. Its production branch is `main`. Pushes to `main` trigger a Vercel build; successful production deployments update https://assurance.claims. A local commit alone does not deploy until it is pushed.

`vercel.json` declares Vite, `npm run build`, and the `dist` output directory. Vercel uses the existing project environment and domains. No new project, API token, webhook secret, or domain was created for this connection. Project Settings → Git shows the connected repository. The project API readback confirmed GitHub repository identity and `productionBranch: main`.

This integration deploys the frontend only. Neon Functions, database migrations, and backend environment changes still use the existing explicit Neon deployment workflow. Coordinate backend changes before publishing a dependent frontend. Persistent activation remains disabled in the backend until its separately documented setup and verification are complete.

The connection is being verified with this documentation-only push. Inspect the Vercel deployment associated with its Git SHA to confirm the GitHub trigger, build result, and production alias. A connection alone is not evidence that a build succeeded. Subsequent verification is recorded in docs/hosting.md and docs/change-log.md.
