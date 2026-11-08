# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`), file drop zone (`src/ui/FileDrop.tsx`), stateful button, step loader and timeline (`src/ui/motion.tsx`), and the sliding pill in the step tracker (`src/ui/SectionNav.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case). Sections on the case page use `#section-overview`, `#section-documents`, `#section-authorization` (Agent work), `#section-review` (optional review), `#section-outreach` and `#section-outcomes`. Agent work appears first. Legacy review and manual communications stay rendered inside a collapsed Additional review and communication tools panel; next-step links open its enclosing details before scrolling.

## Next-step model

`src/progress.ts` derives one progress object per case. The sidebar, overview cards, case header, next-step card, step tracker and section tags all read it, so they never disagree. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`. The snapshot comes from existing endpoints: `/cases/:id/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`.

Each case has:

- **owner**: `you` (the user must act), `waiting` (the agent, insurer or employer is working), or `done` (an outcome was reported with a decision);
- **title, note, CTA**: one sentence, an optional reason, and at most one action that scrolls to the right section or opens the details editor. A waiting case has no CTA unless the agent panel is useful;
- **steps**: Details, Documents, Agent work, Outcome, each `done`, `current` or `todo`.

Rules are evaluated in priority order and the first match wins. The agent asking for help comes first, and its `reason` becomes the card's note. Then come an uncertain delivery, a reported outcome, a draft awaiting approval, a failed agent session, the agent working or waiting, a reply received, a review running, missing description when there are also no documents, agent work not enabled for the account, and finally starting a previously saved case. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness from the autonomy response takes precedence over legacy crew access.

The overview groups cases into **Needs you**, **Waiting on others** and **Resolved**. Its headline counts cases that need the user, and the dark card shows the highest-priority one. The dark next-step style is reserved for the user's move; waiting and resolved cards are light.

Progress refreshes when any non-GET request to `/cases/:id/...` succeeds. `src/services.ts` dispatches `assurance:case-changed`. It also refreshes on window focus and every 30 seconds while the tab is visible. The overview issues six requests per case per refresh. A server-side summary endpoint would reduce that if case counts grow.

## Copy and hierarchy rules

Two rounds of a persona-based design review set these rules (verdicts were kept outside the repository):

- The landing keeps two signature lines, "Insurance is complicated. Getting help shouldn't be." and "You've got enough on your plate.", and drops other slogans.
- Relevant qualifications appear where they apply: under money ("To investigate" / "Not verified savings"), under AI output, and next to authorization.
- One filled button per view: the next-step CTA. Other triggers, such as the optional review's "Run agent team" and "Stop agent work", are secondary.
- Unknown amounts show a small "Add bill and EOB amounts" prompt, never a large empty value. A reported outcome replaces the bill and EOB bars with "Reported you now owe".

## Verifying UI changes

`npm run build` type-checks and bundles. `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend. Some open the overview and expect a case's `article` without navigating; with the overview as the signed-in default, they must open the case first.

## Concurrent intake integration

The grouped dashboard, shared next-action model, progress steps/status tags, outcome amount display, document add-another control, and refresh notifications are preserved alongside the streamlined intake. New intake still accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Inline owner answers, visible stop, and collapsed scope/engine metadata remain. Repeated prototype labels and the old permission-writing prompt are not restored.

Verification after integration: all 10 progress/activation-state tests, both mocked activation/intake browser fixtures, and the production build passed. The build retains the bundle-size warning and notes that the dynamically imported services module is also statically imported.
