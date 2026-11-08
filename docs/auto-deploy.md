# Automatic frontend deployments

The existing Vercel project `assurance-claims` is connected to the GitHub repository `pranayD21/autonomouscompany`. Its production branch is `main`. Pushes to `main` trigger a Vercel build; successful production deployments update https://assurance.claims. A local commit alone does not deploy until it is pushed.

`vercel.json` declares Vite, `npm run build`, and the `dist` output directory. Vercel uses the existing project environment and domains. No new project, API token, webhook secret, or domain was created for this connection. Project Settings → Git shows the connected repository. The project API readback confirmed GitHub repository identity and `productionBranch: main`.

This integration deploys the frontend only. Neon Functions, database migrations, and backend environment changes still use the existing explicit Neon deployment workflow. Coordinate backend changes before publishing a dependent frontend. Persistent activation is now enabled for approved operators after the separately documented live setup verification; backend configuration still deploys through Neon.

Verified with documentation-only push d0cdf05: Vercel automatically created deployment dpl_6TZDiVgGMCXTEsA9QZjusy281zAz from GitHub, built it successfully in 12 seconds, and marked it Current Production with assurance.claims assigned. Live HTML returned 200 and serves the new index-Zba2bcoQ.js bundle. No manual deployment command or token was used. See docs/hosting.md and docs/change-log.md.
