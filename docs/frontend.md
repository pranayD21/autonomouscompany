# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`; its link grid uses a `minmax(0, 1fr)` column so the active tile stays inside the collapsed 76px rail), the upload pill (`src/ui/FileDrop.tsx`, a shrunk file-upload drop zone) and the number ticker (`src/ui/motion.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case). While the session check is pending, `#home` renders the landing page immediately and other non-workspace URLs render nothing (plain paper); only `#workspace` and `#case/...` show the "Loading your session…" shell. This stops the shell's header and footer divider lines flashing before the landing page.

## Workspace layout (simplified 2026-11-08)

The user asked for the app to be as simple as the landing page, keeping only what the case workflow needs. Each screen answers three questions in order: what is happening, does it need me, and what has been done.

**Overview** (`src/Overview.tsx`, styles in `src/overview.css`; re-exported from `src/Workspace.tsx` for fixtures). Redesigned 2026-11-08 to match the landing page, with layout ideas from 21st.dev ("Stats Bento" by ui layout, "Stats cards with links" by Ephraim Duncan, "KPI Tile" by OSAGI; no 21st.dev code was copied, only the layout ideas, rebuilt in plain CSS). Top to bottom:

- Header: time-of-day greeting, a large tight "Your cases." heading with the blue wordmark period, one factual sentence ("1 case needs you. Assurance is handling the other one." / "Nothing needs you right now."), and the landing-style **Open a case** pill (ink with a blue arrow circle that turns 45° on hover).
- Bento row: a dark ink **Reported savings** card (diagonal hatch and blue glow, animated count-up, "from recorded insurer decisions. Not a verified payout." caveat); a **Needs you** card that links straight to the first case needing the owner and shows its next step, or "You're all caught up"; and an **All cases** card with a segmented needs-you/waiting/resolved meter and legend. Reported savings is the sum of each case's latest outcome `reduction_cents`.
- Case list: numbered rows (`01`, `02`… in blue monospace, like the landing "How it works" steps), sorted needs-you, waiting, resolved. Each shows case type and insurer/employer, title, the `deriveProgress` next step (amber when it needs the owner), the status badge, any reported savings, and an arrow circle that fills blue on hover. A sliding white hover highlight and a filter pill (All / Needs you / Waiting / Resolved, with counts) use `motion` layout animations. Unloaded progress shows shimmer placeholders. **Open another case** closes the list.

Progress comes from `deriveProgress` in `src/progress.ts` via `useProgressMap`. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`; its snapshot comes from `/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`. It refreshes when a non-GET `/cases/:id/...` request succeeds (`src/services.ts` dispatches `assurance:case-changed`), on window focus, and every 30 seconds while the tab is visible. Pending phone intakes and the phone-link control (`src/PhoneIntakes.tsx`) appear only here, under the header. The generic `.surface a` link colour in `src/style.css` skips classes starting with `ov-`.

**Case page** (`CaseView` in `src/Workspace.tsx`), top to bottom:

1. Header: back link, case type and claim number, title, Delete.
2. Claim conversation (`src/Autonomy.tsx`, region "Case agent activation"): a single heading from `sessionStatus` (Getting started, Working, Waiting, Needs your attention, Agent finished, Stopped, Not started), one line of detail, the agent's goal, and **Stop agent work** while an authority is active. Its paper surface, DM Sans typography, ink text and blue accents reuse the landing-page tokens. A blue orb animates only for active working/queued/starting states; stopped/error states desaturate it and reduced-motion preferences disable its animation. When the agent needs the owner, the latest `request_human_help` question appears as an Assurance message, with **Continue with updated information** retained. Active direct-model sessions also show the composer while working or waiting, so owners can provide updates without waiting for a question. A Naïve session still shows its existing approval controls, not the direct-model composer. A case that has never started, or was stopped, shows **Start handling my case**; a completed case does not.
3. Outcome (`src/Outcomes.tsx`): rendered only after an outcome exists. A savings card shows the reported reduction ("You save", animated count-up), a claim-decision pill, animated before/now bars, and refund received, followed by the summary, a collapsed explanation with quotes, and the "not a verified payout" caveat.
4. Activity: one newest-first feed merging agent decisions (`/autonomy`), sent messages (`/actions`, matched by the decision's `action_id`) and received replies (`/replies`). Emails and calls show recipient, subject, delivery state and a collapsed message body. Replies show sender, subject, and whether they were held. Questions, waits and case closure appear as plain sentences.
5. Documents (`src/Documents.tsx`): an **Add documents** pill in the section header (a blue upload tile that springs up and tilts out of a dashed outline on hover or drag; the label swaps to "Drop to upload" and then upload progress) above a compact list with reading state, download, and a collapsed "What we read" transcription with optional confirmation. Dropping or choosing files uploads them immediately, one after another, with progress shown in the zone; uploads are saved as `kind: "other"` and reading starts automatically, the same as intake.
6. Details: description, a compact fact list (insurer, employer, claim number, member ID, date, state, stage, bill and EOB amounts when given), notes, and **Edit details**, which opens the existing `CaseForm`.

### Claim composer

`src/ui/ClaimComposer.tsx` adapts the rounded input and compact toolbar from the user-supplied 21st.dev prompt-box reference without its dark palette, global style injection, or simulated voice/search/think/canvas features. It uses React and the existing icons; no dependency or configuration changes are required. Styles live in `src/style.css` and use the shared landing tokens from `src/landing.css`.

The controlled textarea grows up to 200 px and retains the 4,000-character API limit. Enter submits nonblank text; Shift + Enter inserts a newline, and IME composition does not submit. A labeled circular send button and saving indicator reflect the real owner-update request. Saving disables editing and submission. The **Case documents** shortcut scrolls to the existing Documents section and focuses its uploader; it does not attach or upload a file with the message. Existing upload validation, storage and extraction remain unchanged.

`Autonomy` sends through the existing authenticated `POST /cases/:id/updates` endpoint, preserving its retry UUID and error handling. On successful saving, it displays the latest locally submitted update in a right-aligned bubble. This is a save receipt, not a generated agent answer or a complete conversation history. Saved updates remain in case notes after reload; the receipt bubble itself is not persisted. Processing follows the existing agent scheduler. Case-keyed mounting in `src/Workspace.tsx` resets drafts and receipts on navigation between claims. No new external communication, agent permissions, or provider behavior is introduced.

Verify with `npx tsx --test scripts/claim-composer.test.tsx scripts/activation-state.test.ts scripts/progress.test.ts` and `npm run build` with the three public service URLs configured. The composer tests cover rendered labels, empty-message disabling, saving state, answer-mode copy and safe escaping; they do not exercise browser keyboard, scrolling, focus, or layout behavior.

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

The backdrop component is `src/components/hero-backdrop.tsx`, rendered first inside `<main className="landing-page">` in `src/Landing.tsx`. It shows nine documentary photos of real people recovering from injuries: people on crutches, hand and leg therapy, a patient in a hospital lift, someone being helped into a wheelchair or down steps. One photo shows at a time; every 5 seconds a 0.45s crossfade switches to the next. It pauses while the tab is hidden, and with reduced motion only the first photo shows. Each photo has an `objectPosition` so the cover crop keeps the person in view. The layer is `aria-hidden`.

Its size depends on scroll position (`useBackdropLayout` in `Landing.tsx`, which measures the header and hero with a `ResizeObserver` into `--header-h` and `--hero-end`, and adds `is-at-top` to `<main>` while `scrollY < 8`):

- At the top of the page the photos cover at least the full viewport, behind the header, hero and anything else in view, with no top or bottom fade. The divider lines under the header and above "How it works" are hidden.
- Once the visitor scrolls, the layer shrinks to the header + hero area over 0.5s and `.hero-backdrop-fade` fades in: solid paper over the header, a fade in at the top of the hero, and a fade out over its bottom 30%. The divider lines come back.

Styles in `src/landing.css` (`.hero-backdrop*`) keep a little colour (`saturate(.35)`) at 42% opacity and wash the edges toward the paper colour so the wordmark and copy stay readable.

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
