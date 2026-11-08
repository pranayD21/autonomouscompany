import {test} from "node:test";
import assert from "node:assert/strict";
import {deriveProgress, type Snapshot} from "../src/progress";
import type {BillCase} from "../backend/schema";

const base = {id: "c", owner_id: "u", title: "Case", case_type: "health_insurance", intake: {injury_description: "ER bill", insurer_name: "Northwind"}, revision: 1, bill_cents: 120000, eob_cents: 40000, notes: "", status: "new", analysis: null, created_at: new Date()} as unknown as BillCase;
const doc = {state: "ready", extraction_state: "completed", extraction_result: {}, confirmed_at: "2026-11-07"};
const empty: Snapshot = {docs: [], actions: [], replies: [], outcomes: []};

test("asks for amounts before documents on health disputes", () => {
  const p = deriveProgress({...base, bill_cents: null}, empty, true);
  assert.equal(p.owner, "you"); assert.equal(p.step, "details"); assert.equal(p.cta?.target, "edit");
});

test("asks for documents, then permission to start the agent", () => {
  assert.equal(deriveProgress(base, empty, true).step, "documents");
  const ready = deriveProgress(base, {...empty, docs: [doc]}, true);
  assert.equal(ready.title, "Give the agent permission to start"); assert.equal(ready.owner, "you");
  assert.equal(deriveProgress(base, {...empty, docs: [doc]}, false).owner, "waiting");
});

test("unconfirmed transcription needs the user", () => {
  const p = deriveProgress(base, {...empty, docs: [{...doc, confirmed_at: null}]}, true);
  assert.equal(p.step, "documents"); assert.equal(p.cta?.label, "Check document");
});

test("active agent means waiting, but a request flips it to the user with the agent's reason", () => {
  const autonomy = {authorities: [{state: "waiting"}], sessions: [{state: "waiting", waiting_on: "Northwind’s reply"}]};
  const waiting = deriveProgress(base, {...empty, docs: [doc], autonomy}, true);
  assert.equal(waiting.owner, "waiting"); assert.equal(waiting.title, "Waiting on Northwind’s reply"); assert.equal(waiting.cta?.target, "#section-authorization");
  const ask = deriveProgress(base, {...empty, docs: [doc], autonomy: {authorities: [{state: "active"}], sessions: [{state: "human_required", reason: "Need the visit date."}]}}, true);
  assert.equal(ask.owner, "you"); assert.equal(ask.note, "Need the visit date.");
});

test("a draft waits for approval and an outcome resolves the case", () => {
  assert.equal(deriveProgress(base, {...empty, docs: [doc], actions: [{state: "draft"}]}, true).title, "Approve your outreach draft");
  const done = deriveProgress(base, {...empty, docs: [doc], outcomes: [{report: {claim_decision: "accepted", original_responsibility_cents: 120000, final_responsibility_cents: 40000, reduction_cents: 80000}}]}, true);
  assert.equal(done.owner, "done"); assert.equal(done.steps.outcome, "done");
});

test("progress is not marked loaded until the snapshot arrives", () => {
  assert.equal(deriveProgress(base, undefined, true).loaded, false);
});
