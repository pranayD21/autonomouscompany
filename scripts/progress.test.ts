import {test} from "node:test";
import assert from "node:assert/strict";
import {plainWaiting, deriveProgress, type Snapshot} from "../src/progress";
import type {BillCase} from "../backend/schema";

const base = {id: "c", owner_id: "u", title: "Case", case_type: "health_insurance", intake: {injury_description: "ER bill", insurer_name: "Northwind"}, revision: 1, bill_cents: 120000, eob_cents: 40000, notes: "", status: "new", analysis: null, created_at: new Date()} as unknown as BillCase;
const doc = {state: "ready", extraction_state: "completed", extraction_result: {}, confirmed_at: "2026-11-07"};
const empty: Snapshot = {docs: [], actions: [], replies: [], outcomes: []};

test("missing amounts do not block starting an existing health dispute", () => {
  const p = deriveProgress({...base, bill_cents: null}, empty, true);
  assert.equal(p.owner, "you"); assert.equal(p.step, "agent"); assert.equal(p.cta?.target, "#section-authorization");
});

test("starts from a narrative or documents without another permission form", () => {
  assert.equal(deriveProgress(base, empty, true).step, "agent");
  const ready = deriveProgress(base, {...empty, docs: [doc]}, true);
  assert.equal(ready.title, "Start handling this case"); assert.equal(ready.owner, "you");
  assert.equal(deriveProgress(base, {...empty, docs: [doc]}, false).owner, "waiting");
});

test("machine transcription does not require owner confirmation to start", () => {
  const p = deriveProgress(base, {...empty, docs: [{...doc, confirmed_at: null}]}, true);
  assert.equal(p.step, "agent"); assert.equal(p.cta?.label, "Start agent work");
});

test("active agent means waiting, but a request flips it to the user with the agent's reason", () => {
  const autonomy = {authorities: [{state: "waiting"}], sessions: [{state: "waiting", waiting_on: "Northwind’s reply"}]};
  const waiting = deriveProgress(base, {...empty, docs: [doc], autonomy}, true);
  assert.equal(waiting.owner, "waiting"); assert.equal(waiting.title, "Waiting on Northwind’s reply"); assert.equal(waiting.cta?.target, "#section-authorization");
  const ask = deriveProgress(base, {...empty, docs: [doc], autonomy: {authorities: [{state: "active"}], sessions: [{state: "human_required", reason: "Need the visit date."}]}}, true);
  assert.equal(ask.owner, "you"); assert.equal(ask.note, "Need the visit date.");
});

test("a message still being sent never asks the owner to approve it, and an outcome resolves the case", () => {
  assert.notEqual(deriveProgress(base, {...empty, docs: [doc], actions: [{state: "draft"}]}, true).title, "Approve your outreach draft");
  const done = deriveProgress(base, {...empty, docs: [doc], outcomes: [{report: {claim_decision: "accepted", original_responsibility_cents: 120000, final_responsibility_cents: 40000, reduction_cents: 80000}}]}, true);
  assert.equal(done.owner, "done"); assert.equal(done.steps.outcome, "done");
});

test("progress is not marked loaded until the snapshot arrives", () => {
  assert.equal(deriveProgress(base, undefined, true).loaded, false);
});

 test("direct activation availability overrides legacy crew access",()=>{const p=deriveProgress(base,{...empty,autonomy:{activation_available:true}},false);assert.equal(p.owner,"you");assert.equal(p.title,"Start handling this case");});

test("internal waiting reasons are shown in plain words", () => {
  const autonomy = {authorities: [{state: "active"}], sessions: [{state: "waiting", waiting_on: "Authority, credential, ownership, or operator access is no longer active."}]};
  assert.equal(deriveProgress(base, {...empty, docs: [doc], autonomy}, true).title, "Waiting on something on our side");
  assert.equal(plainWaiting("waiting for Northwind’s reply"), "Waiting on Northwind’s reply");
});
