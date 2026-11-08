# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`), the upload pill (`src/ui/FileDrop.tsx`, a shrunk file-upload drop zone) and the number ticker (`src/ui/motion.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case).

## Workspace layout (simplified 2026-11-08)

The user asked for the app to be as simple as the landing page, keeping only what the case workflow needs. Each screen answers three questions in order: what is happening, does it need me, and what has been done.

**Overview** (`Overview` in `src/Workspace.tsx`): a time-of-day greeting, "Your cases", a stat strip (open cases, cases that need you, and reported savings with an animated count-up), then one tile per case plus "Open a new case". Reported savings is the sum of each case's latest outcome `reduction_cents`, labeled as coming from recorded insurer decisions and not a verified payout. Tiles fade in with a short stagger, share a sliding hover highlight, carry a top accent colored by status, and show the case type, a status badge (Needs you / Waiting / Resolved) and one summary line, both from `deriveProgress` in `src/progress.ts` via `useProgressMap`. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`; its snapshot comes from `/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`. It refreshes when a non-GET `/cases/:id/...` request succeeds (`src/services.ts` dispatches `assurance:case-changed`), on window focus, and every 30 seconds while the tab is visible. Pending phone intakes and the phone-link control (`src/PhoneIntakes.tsx`) appear only here.

**Case page** (`CaseView` in `src/Workspace.tsx`), top to bottom:

1. Header: back link, case type and claim number, title, Delete.
2. Status card (`src/Autonomy.tsx`, region "Case agent activation"): a single heading from `sessionStatus` (Getting started, Working, Waiting, Needs your attention, Agent finished, Stopped, Not started), one line of detail, the agent's goal, and **Stop agent work** while an authority is active. When the agent needs the owner, the latest `request_human_help` question appears in the card with the response box, **Send response**, and **Continue with updated information**. A Naïve session still shows **Review pending actions**. A case that has never started, or was stopped, shows **Start handling my case**; a completed case does not.
3. Outcome (`src/Outcomes.tsx`): rendered only after an outcome exists. A savings card shows the reported reduction ("You save", animated count-up), a claim-decision pill, animated before/now bars, and refund received, followed by the summary, a collapsed explanation with quotes, and the "not a verified payout" caveat.
4. Activity: one newest-first feed merging agent decisions (`/autonomy`), sent messages (`/actions`, matched by the decision's `action_id`) and received replies (`/replies`). Emails and calls show recipient, subject, delivery state and a collapsed message body. Replies show sender, subject, and whether they were held. Questions, waits and case closure appear as plain sentences.
5. Documents (`src/Documents.tsx`): an **Add documents** pill in the section header (a blue upload tile that springs up and tilts out of a dashed outline on hover or drag; the label swaps to "Drop to upload" and then upload progress) above a compact list with reading state, download, and a collapsed "What we read" transcription with optional confirmation. Dropping or choosing files uploads them immediately, one after another, with progress shown in the zone; uploads are saved as `kind: "other"` and reading starts automatically, the same as intake.
6. Details: description, a compact fact list (insurer, employer, claim number, member ID, date, state, stage, bill and EOB amounts when given), notes, and **Edit details**, which opens the existing `CaseForm`.

Removed from the signed-in app, with the reason:

- The hardcoded "See what Assurance is doing for you" card was identical on every case, so it gave no information.
- The bill/EOB "potential discrepancy" card and the overview's "$ to investigate" total subtracted two numbers the user typed in, which is not a verified discrepancy and means nothing for workplace injury. The amounts remain in Details. Money now comes only from agent-reported outcomes (savings card and overview total).
- The section tab bar and Done/Next-step tags. (The tabs were briefly restored, then removed again at the user's request.)
- "Case agent setup", "Scope and controls", engine name, finish condition, and "Round N" labels were internal. The engine label helper remains in `activation-state.ts` for tests.
- The legacy optional Naïve review and the manual draft-and-approve outreach form. Agent emails enable reply monitoring automatically (`backend/open-case-actions.ts`), and replies now appear in Activity. The backend endpoints are unchanged. `src/CrewReview.tsx`, `src/Outreach.tsx`, `src/ui/SectionNav.tsx` and `src/ui/CaseSection.tsx` were deleted; `src/ui/motion.tsx` keeps only `NumberTicker`.
- The document-type dropdown (uploads use `kind: "other"`).
- The visible green live dot (a hidden "Live updates connected" label remains, and a visible pill appears only while reconnecting), the workspace footer, and the per-case status text in the sidebar.

`deriveProgress` no longer tells the owner to "Approve your outreach draft". No approval control exists, and an agent email is briefly in `draft` while it sends.

## Brand mark and hero wordmark

The logo is a two-stroke "A" drawn as the `Logo` SVG component in `src/Icons.tsx`, filled with the brand blue (`--blue`, `#2465ef`). It appears in the landing header, the sign-in header and the workspace sidebar, nudged down `.09em` so it centres on the lowercase wordmark. `assets/icon.svg` (README) and `public/favicon.svg` use the same paths with no background.

The landing hero (`src/components/strikethrough-replace.tsx`, styles in `src/landing.css`) animates in two phases. First a line strikes through "in" and a handwritten blue "as" is written above it. Then the "as" drops into line, sitting `.1em` below the bottom of "surance" (canvas-measured ink bounds) so the script reads as part of the word, while the struck "in" slides down at full size behind the "Insurance is complicated." heading. A mask fades the "in" out before it reaches that heading (the `fadeBelow` prop names it). The mask's stops are offset by the registered `--in-y` property so the fade stays fixed on the page while the word moves. Offsets are measured in em and re-measured on font load and resize. Extra space under the wordmark (`.42em` bottom padding) sets the heading and call to action lower so more of the dropped "in" shows. With reduced motion the page shows the settled layout immediately.

## Hero photo backdrop

Behind the whole landing page, `src/components/hero-backdrop.tsx` (rendered first inside `<main className="landing-page">` in `src/Landing.tsx`, `position: fixed` and full-viewport, so it sits behind the header, hero, steps and footer and stays put while the page scrolls) shows nine documentary photos of real people recovering from injuries: people on crutches, hand and leg therapy, a patient in a hospital lift, someone being helped into a wheelchair or down steps. One photo fills the hero at a time; every 5 seconds a 0.45s crossfade switches to the next, and the cycle repeats. It pauses while the tab is hidden, and with reduced motion only the first photo shows. Each photo has an `objectPosition` so the cover crop keeps the person in view. Styles in `src/landing.css` (`.hero-backdrop*`) keep a little colour (`saturate(.35)`) at 42% opacity, have no top or bottom fade, and wash the edges toward the paper colour so the wordmark and copy stay readable. The strip is `aria-hidden`.

Files are `public/hero/01-*.webp` to `09-*.webp` (about 820 KB together, up to 1600px). Staged stock photos were replaced with real people on 2026-11-08 at the user's request. Sources:

- Public domain (US Navy / Navy Medicine on Flickr and Wikimedia Commons): hand therapy (Flickr 52033349927), wheelchair help (Commons "US Navy 070919-N-6278K-182"), patient lift (Flickr 51929649462), leg rehab (Flickr 52971670817), helped down steps (Commons "US Navy 050413-N-1485H-010"), band therapy (Flickr 52257078214).
- Public domain mark on Flickr: crutches outdoors ("Duel Crutches", Belur Math, Howrah, 51633131050) and crutches in the city ("IMG_0037", evanizzle79, 54314915502).
- CC BY 2.0: crutches on a street in Chiapas by Adam Jones (Commons "Man on Crutches - San Cristobal de las Casas - Chiapas - Mexico.jpg"). The licence requires credit, which `src/Landing.tsx` gives in the footer (`.photo-credit`). Keep that credit while the photo is used.

These people are not Assurance customers. Never caption the photos or present them as cases, outcomes or testimonials. Film stills, staged training drills, war scenes, children, and identifiable patients photographed without evident consent were deliberately excluded.

## Copy and hierarchy rules

Two rounds of a persona-based design review set these rules (verdicts were kept outside the repository):

- The landing page has no FAQ/questions section; it was removed on 2026-11-08 at the user's request. After the hero and "How it works" steps it goes straight to the footer.
- The landing keeps two signature lines, "Insurance is complicated. Getting help shouldn't be." and "You've got enough on your plate.", and drops other slogans.
- Relevant qualifications appear under money and AI output, and a concise scope disclosure accompanies submission. Repeated prototype banners are removed.
- Money appears only as agent-reported outcome figures with their caveat, or as amounts the user typed, labeled as such in Details.

## Verifying UI changes

`npm run build` type-checks and bundles; it needs the three `VITE_*` service URLs (placeholders such as `https://fixture-cases.compute.example.com` work for a local build). `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. With the same placeholder variables, `npx tsx scripts/activation-ui-fixture.ts` and `npx tsx scripts/intake-ui-fixture.ts` run mocked browser checks. `CaseView` and `Overview` are exported so a fixture page can render them against mocked API routes. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend; the legacy crew, outreach and reply smokes target controls that were removed from the UI.

## Intake behavior

New intake accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness takes precedence over legacy crew access. Repeated prototype labels and the old permission-writing prompt are not restored. The production build keeps its bundle-size warning and the note that the dynamically imported services module is also statically imported.
