# Recorded case outcomes

`backend/case-outcome.ts` implements `record_outcome` for the case-scoped MCP service. Migration 0017 adds immutable outcome reports tied to the case, issuing credential, operation ID, and input revision. The agent supplies its calculations and explanation; the service does not calculate a savings amount or fee.

The report separates original and final patient responsibility, reductions, refunds actually received, and claim decisions. Amounts are integer USD cents; unknown amounts remain null. A pending refund must not be represented as received cash. A report must contain exact quotes from confirmed ready document transcriptions or currently accepted case replies. Public research, outbound action receipts, and unsupported case notes are not outcome evidence.

The service locks the owned case, validates the evidence, saves one report, and advances the revision once. Concurrent identical operation retries return the original record. Changed payloads under the same operation ID fail. Corrections use a new operation ID and preserve the earlier report. Agent-authored outcomes do not enqueue another model wake.

`case_get` returns the reports as `agent_reported`, with `independently_verified: false`. Readback rechecks the cited quotes against current evidence and sets `evidence_current: false` when a document loses confirmation or a reply is held. Historical reports remain readable; retry acknowledgement alone must not be treated as proof that the evidence is still current.

An exact quote establishes traceability, not that the agent interpreted the statement correctly or that a bank transfer occurred. Recording a report does not permit `stop_case(goal_met)`, mark the case complete, send a final message, or charge a fee. Outcome verification, customer-facing outcome presentation, and test-mode checkout still need implementation. Naïve's local tool configuration includes the new tool; publishing it remains dependent on the compatible setup credential.

## Verification

Run `scripts/case-outcome.test.ts` against a disposable database using `OUTREACH_TEST_DATABASE_URL`. It covers concurrent retries, revision increments, separate unknown refunds, owner isolation, changed retry rejection, invented quotes, foreign document references, unconfirmed transcriptions, and stale-evidence readback. Protocol and agent-configuration regressions run alongside it. These checks use synthetic fixtures and no live inference or communications.

Migration 0017 and the tool are deployed. Twelve tests and the build passed. `npx tsx scripts/outcome-live-smoke.ts` passed against the deployed MCP endpoint, then deleted its temporary synthetic case, document/transcription, credential, and outcome. It tests the service integration, not a Naïve agent’s reasoning or an actual insurer outcome.
