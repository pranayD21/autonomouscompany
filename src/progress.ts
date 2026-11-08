// One derived "where is this case and who moves next" model, shared by the
// overview, sidebar, case header, next-step card and step tracker so they
// never disagree. Built from the same per-case endpoints the sections use.
import {useEffect, useState} from "react";
import type {BillCase} from "../backend/schema";

type Doc = {state: string; extraction_state: string | null; extraction_result: unknown | null; confirmed_at: string | null};
type Run = {status: string; stop_reason?: string | null; saved_at?: string | null; result?: {human_help_required?: boolean} | null};
type Action = {state: string; approved_at?: string | null; created_at?: string};
type Reply = {disposition: string};
type Outcome = {report: {claim_decision: string; original_responsibility_cents: number | null; final_responsibility_cents: number | null; reduction_cents: number | null}};
type Autonomy = {activation_available?: boolean; authorities?: {state: string}[]; sessions?: {state: string; waiting_on?: string | null; reason?: string | null}[]};

export type Snapshot = {docs: Doc[]; run?: Run; actions: Action[]; replies: Reply[]; outcomes: Outcome[]; autonomy?: Autonomy};
export type Owner = "you" | "waiting" | "done";
export type StepId = "details" | "documents" | "agent" | "outcome";
export type StepState = "done" | "current" | "todo";
/** Where the next-step CTA goes: a section anchor, or the inline details editor. */
export type Target = "edit" | "#section-documents" | "#section-outreach" | "#section-outcomes" | "#section-authorization";
export type Progress = {
  loaded: boolean;
  owner: Owner;
  title: string;
  note?: string;
  cta?: {label: string; target: Target};
  step: StepId;
  steps: Record<StepId, StepState>;
  outcome?: Outcome["report"];
};

export const STEP_LABELS: Record<StepId, string> = {details: "Details", documents: "Documents", agent: "Agent work", outcome: "Outcome"};
export const STEP_ORDER: StepId[] = ["details", "documents", "agent", "outcome"];
export const OWNER_LABEL: Record<Owner, string> = {you: "Needs you", waiting: "Waiting", done: "Resolved"};
const WORKING = ["start_pending", "queued", "running", "rescheduling"];

const counterpart = (c: BillCase) => c.intake?.insurer_name || c.intake?.employer_name || (c.case_type === "workplace_injury" ? "the employer" : "the insurer");

const ACTIVE_AUTHORITY = ["active", "waiting", "human_required"];
const SESSION_WORKING = ["starting", "queued", "running"];
const SESSION_WAITING = ["idle", "waiting"];
const SESSION_NEEDS_YOU = ["human_required", "needs_input"];
const SESSION_FAILED = ["failed", "error"];

export function deriveProgress(c: BillCase, s: Snapshot | undefined, agentEnabled: boolean): Progress {
  const docs = s?.docs ?? [];
  const run = s?.run;
  const actions = s?.actions ?? [];
  const replies = (s?.replies ?? []).filter(r => r.disposition === "accepted");
  const outcomes = s?.outcomes ?? [];
  const authorities = s?.autonomy?.authorities ?? [];
  const sessions = s?.autonomy?.sessions ?? [];
  const latest = sessions[0];
  const hasDescription = !!c.intake?.injury_description?.trim();
  const readyDocs = docs.filter(d => d.state === "ready");
  const agentActive = authorities.some(a => ACTIVE_AUTHORITY.includes(a.state));
  const agentEnded = authorities.length > 0 && !agentActive;
  const reviewRunning = c.status === "analyzing" || (!!run && WORKING.includes(run.status) && !run.result);
  const sent = actions.filter(a => ["dispatching", "submitted"].includes(a.state));
  const drafts = actions.filter(a => a.state === "draft");
  const needsYou = authorities.some(a => a.state === "human_required") || sessions.some(x => SESSION_NEEDS_YOU.includes(x.state));

  const steps: Record<StepId, StepState> = {
    details: hasDescription || readyDocs.length > 0 ? "done" : "todo",
    documents: readyDocs.some(d => !!d.extraction_result) ? "done" : "todo",
    agent: sessions.some(x => x.state === "completed") || outcomes.length > 0 ? "done" : "todo",
    outcome: outcomes.length > 0 ? "done" : "todo",
  };
  const make = (step: StepId, owner: Owner, title: string, cta?: Progress["cta"], note?: string): Progress => {
    const marked = {...steps};
    if (owner !== "done") marked[step] = "current";
    return {loaded: !!s, owner, title, cta, note, step, steps: marked, outcome: outcomes[0]?.report};
  };
  const who = counterpart(c);
  const agentCta = {label: "Open agent work", target: "#section-authorization" as const};

  // Priority order: first match wins.
  if (needsYou) return make("agent", "you", "Answer the agent’s request", {label: "Open request", target: "#section-authorization"}, sessions.find(x => SESSION_NEEDS_YOU.includes(x.state))?.reason || "Work is paused until you respond.");
  if (actions.some(a => a.state === "unknown")) return make("agent", "you", "Check your message’s delivery", {label: "Check status", target: "#section-outreach"}, "Don’t send it again until you’ve checked.");
  if (outcomes.length) {
    const o = outcomes[0].report;
    const settled = ["accepted", "partially_accepted", "denied"].includes(o.claim_decision);
    return make("outcome", settled ? "done" : "waiting", settled ? "Review the reported outcome" : "Outcome reported — decision pending", {label: "View outcome", target: "#section-outcomes"});
  }
  if (drafts.length) return make("agent", "you", "Approve your outreach draft", {label: "Review draft", target: "#section-outreach"}, "Nothing is sent until you approve it.");
  if (latest && SESSION_FAILED.includes(latest.state)) return make("agent", "you", "Restart agent work", agentCta, "The agent stopped before finishing. Nothing was completed for you.");
  if (agentActive && latest && SESSION_WORKING.includes(latest.state)) return make("agent", "waiting", "The agent is working on your case", agentCta, "Nothing needed from you. Add new documents anytime.");
  if (agentActive) return make("agent", "waiting", latest?.waiting_on ? `Waiting on ${latest.waiting_on}` : replies.length ? `Agent is reviewing ${who}’s reply` : sent.length ? `Waiting on ${who}’s reply` : "The agent is on your case", agentCta, "Nothing needed from you. We’ll flag anything that needs you.");
  if (replies.length) return make("agent", "you", `Read ${who}’s reply`, {label: "Read reply", target: "#section-outreach"});
  if (sent.length) return make("agent", "waiting", `Waiting on ${who}’s reply`, undefined, "We’ll show their reply here when it arrives.");
  if (reviewRunning) return make("agent", "waiting", "Review in progress", undefined, "Usually a minute or two. Nothing needed from you.");
  if (!hasDescription && readyDocs.length === 0) return make("details", "you", "Tell us what happened", {label: "Add details", target: "edit"});
  if (!(s?.autonomy?.activation_available ?? agentEnabled)) return make("agent", "waiting", "Your case is ready for an agent", undefined, "Agent work isn’t switched on for this account yet. Your case is saved.");
  if (agentEnded) return make("agent", "you", "Restart agent work", agentCta, "The last agent session ended without an outcome.");
  return make("agent", "you", "Start handling this case", {label: "Start agent work", target: "#section-authorization"}, "Assurance will organize the evidence and follow up for you.");
}

/** Fire after any change to a case so every progress view refreshes at once. */
export const CASE_CHANGED = "assurance:case-changed";
export function notifyCaseChanged(caseId: string) { window.dispatchEvent(new CustomEvent(CASE_CHANGED, {detail: caseId})); }

async function loadSnapshot(caseId: string, userId: string): Promise<Snapshot> {
  const {api} = await import("./services");
  const base = `/cases/${caseId}`;
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [docs, run, actions, replies, outcomes, autonomy] = await Promise.all([
    safe(api<Doc[]>(`${base}/documents`, {}, userId), []),
    safe(api<Run>(`${base}/crew`, {}, userId), undefined),
    safe(api<Action[]>(`${base}/actions`, {}, userId), []),
    safe(api<{replies: Reply[]}>(`${base}/replies`, {}, userId).then(r => r.replies), []),
    safe(api<Outcome[]>(`${base}/outcomes`, {}, userId), []),
    safe(api<Autonomy>(`${base}/autonomy`, {}, userId), undefined),
  ]);
  return {docs, run, actions, replies, outcomes, autonomy};
}

/** Progress for every case, refreshed on change events, focus and a slow interval. */
export function useProgressMap(cases: readonly BillCase[], userId: string, crewEnabled: boolean): Map<string, Progress> {
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const key = cases.map(c => `${c.id}:${c.revision}:${c.status}`).join("|");
  useEffect(() => {
    let live = true;
    const read = (ids: string[]) => {
      if (document.visibilityState === "hidden") return;
      for (const id of ids) void loadSnapshot(id, userId).then(snap => { if (live) setSnapshots(prev => ({...prev, [id]: snap})); });
    };
    const all = () => read(cases.map(c => c.id));
    all();
    const onChange = (e: Event) => { const id = (e as CustomEvent).detail; if (cases.some(c => c.id === id)) read([id]); };
    window.addEventListener(CASE_CHANGED, onChange);
    window.addEventListener("focus", all);
    const timer = setInterval(all, 30_000);
    return () => { live = false; clearInterval(timer); window.removeEventListener(CASE_CHANGED, onChange); window.removeEventListener("focus", all); };
  }, [key, userId]);
  return new Map(cases.map(c => [c.id, deriveProgress(c, snapshots[c.id], crewEnabled)]));
}

/** Progress for a single case (used by the case page's section tags). */
export function useCaseProgress(c: BillCase, userId: string, agentEnabled: boolean): Progress {
  return useProgressMap([c], userId, agentEnabled).get(c.id)!;
}
