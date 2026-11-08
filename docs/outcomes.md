# Recorded case outcomes

`backend/case-outcome.ts` implements `record_outcome` for the case-scoped MCP service. Migration 0017 adds immutable outcome reports tied to the case, issuing credential, operation ID, and input revision. The agent supplies its calculations and explanation; the service does not calculate a savings amount or fee.

The report separates original and final patient responsibility, reductions, refunds actually received, and claim decisions. Amounts are integer USD cents; unknown amounts remain null. A pending refund must not be represented as received cash. A report must contain exact quotes from confirmed ready document transcriptions or currently accepted case replies. Public research, outbound action receipts, and unsupported case notes are not outcome evidence.

The service locks the owned case, validates the evidence, saves one report, and advances the revision once. Concurrent identical operation retries return the original record. Changed payloads under the same operation ID fail. Corrections use a new operation ID and preserve the earlier report. Agent-authored outcomes do not enqueue another model wake.

`case_get` returns the reports as `agent_reported`, with `independently_verified: false`. Readback rechecks the cited quotes against current evidence and sets `evidence_current: false` when a document loses confirmation or a reply is held. Historical reports remain readable; retry acknowledgement alone must not be treated as proof that the evidence is still current.

An exact quote establishes traceability, not that the agent interpreted the statement correctly or that a bank transfer occurred. Recording a report does not itself mark the case complete, send a final message, or charge a fee. `record_outcome` is in the case agent's tool configuration. Finance's test-mode fee record is described in [payments](payments.md).

At recording time, validation checks the field types, owned case, retry payload, and presence of each exact quote in the eligible source. It does not recompute `reduction_cents` from original and final responsibility, or check that a quote supports each reported amount or claim decision. `evidence_current: true` means the quoted text is still present in eligible evidence. Finance separately checks responsibility-reduction arithmetic before creating a test fee. The outcome remains an agent-reported interpretation at both stages.

## Verification

Run `scripts/case-outcome.test.ts` against a disposable database using `OUTREACH_TEST_DATABASE_URL`. It covers concurrent retries, revision increments, separate unknown refunds, owner isolation, changed retry rejection, invented quotes, foreign document references, unconfirmed transcriptions, and stale-evidence readback. Protocol and agent-configuration regressions run alongside it. These checks use synthetic fixtures and no live inference or communications.

Migration 0017 and the tool are deployed. Twelve tests and the build passed. `npx tsx scripts/outcome-live-smoke.ts` passed against the deployed MCP endpoint, then deleted its temporary synthetic case, document/transcription, credential, and outcome. It tests the service integration, not a Naïve agent’s reasoning or an actual insurer outcome.


## Case workspace view

`GET /cases/:id/outcomes` requires an authenticated owner and returns 404 for another user’s case. `src/Outcomes.tsx` displays the newest report, distinguishes unknown amounts from zero, and warns when evidence is no longer current. The compact **Reported reduction** summary is agent-attributed, not a verified refund or guaranteed savings claim. Original/final reported responsibility, refund received, calculations and supporting quotes remain inspectable in **Outcome details and evidence**. No animated savings ticker is used. It refreshes every 15 seconds and when the case revision changes; responses from an old case or signed-in user are discarded on cleanup. A failed refresh is visible even before a report is available and does not silently present old results as current. The component is included in the case workspace independently of whether an agent review has finished.

`E2E_OUTCOMES_UI=1 npm run test:e2e` adds an explicitly mocked outcome response to exercise populated amounts, unknown refunds, stale evidence, quote expansion, and the empty state. The same test independently calls the real API for owner access and cross-user denial. The fixture UI check does not prove real outcome ingestion; that is covered by the separate live MCP smoke test.


## Ending a synthetic scenario

`stop_case` accepts `synthetic_demo_completed` separately from `goal_met`. It requires synthetic standing authority, a referenced recorded outcome whose supporting quotes are still current, and no uncertain dispatch. The worker rechecks outcome evidence while applying the decision. The stored stop reason explicitly says that the synthetic scenario ended and no real payout was verified. This does not close a real claim, verify coverage or savings, receive money, or create a payment.

Under version-2 permission, `stop_case(goal_met)` requires a current recorded outcome reference, and its result is labeled `evidence_reported_not_independently_verified`. Legacy grants return `OUTCOME_NOT_VERIFIED` for `goal_met`, because nothing in the legacy path sets `verified_goal_met`.

Current outcomes appear in case reads and decision snapshots with `outcome:<id>` evidence references. A quote becoming stale removes the reference from current evidence. The bounded decision prompt asks one question per message.
