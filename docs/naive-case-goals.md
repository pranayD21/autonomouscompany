# Stable goals for Naïve cases

`backend/naive-case-goal.ts` stores an agent-written goal and evidence-based finish condition for each version-2 Naïve session. `setNaiveCaseGoal` checks the authenticated credential, current owner, active authority, and matching session, and rejects a conflicting direct-engine registration. Identical calls are idempotent.

The initial goal is immutable. New evidence can justify a slight refinement to its wording or finish condition through `set_goal` with `refinement_reason`. A changed value without a reason fails with `GOAL_REFINEMENT_REASON_REQUIRED`. Optional `base_revision` rejects stale concurrent changes with `GOAL_REVISION_CONFLICT`; identical retries still return the saved result. The agent must preserve the original objective. The server preserves and exposes the original objective and every refinement for review; it does not pretend a string comparison can prove that a semantic change is slight.

The initial record uses `advocacy_case_agent_events` key/kind `stable_goal`. Refinements append `goal_refinement` events with the new wording, reason, and increasing revision. Every record is marked delivered immediately, so saving or refining the goal cannot wake the run repeatedly. Neither operation changes case evidence or its revision. No new database migration is required.

`readNaiveCaseGoals(db, caseId)` returns the effective `goal` and `finish_condition`, immutable `initial_goal` and `initial_finish_condition`, numeric `revision`, and ordered `history` with reasons and timestamps. `backend/case-tool-service.ts` exposes this under `agent_goals` in `case_get`. `backend/case-tools.ts` describes the original-objective constraint and requires a saved goal before case actions through the existing service guard.

Pending replies, discovering missing information, and asking the owner a question are waiting states, not resolution. The tool instructions require documented resolution or an explicitly supported closure. Recording a goal or a refinement does not expand owner permission, establish an outcome, or bypass existing completion checks. The direct runner retains its separate goal storage and excludes this MCP tool; legacy grants retain their existing behavior.

## Verification

Run `npx tsx --test --test-concurrency=1 scripts/naive-case-goal.test.ts scripts/case-messages.test.ts` with `OUTREACH_TEST_DATABASE_URL` pointing to a disposable database. The suites cover concurrent initial registration, idempotent refinements, immutable original audit, reason requirements, stale revision rejection, history projection, owner/case isolation, revocation, and action rejection before a goal. They also cover agent-authored document types and exact request messages, type-based deduplication, and rejection of changed content under the same operation ID. No external communications are sent.
