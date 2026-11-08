import {DEFAULT_INTAKE_CONSENT} from "../backend/intake-policy";
import {SessionApprovals} from "./SessionApprovals";
import {useEffect, useRef, useState, type FormEvent, type ReactNode} from "react";
import {api} from "./services";
import {activationRequest, sessionNeedsProviderApproval, sessionStatus, type AgentSession} from "./activation-state";
import type {caseDecisions, CaseReply, OutreachAction} from "../backend/schema";
import {ClaimComposer} from "./ui/ClaimComposer";
import {Check, Clock, Inbox, Mail, Phone, Question} from "./Icons";

type Authority = {id: string; state: string; reason: string | null; policy: {version?: number}};
type Decision = Pick<typeof caseDecisions.$inferSelect, "id" | "round" | "state" | "decision" | "result" | "created_at"> & {action_id?: string | null};
type Setup = {id: string; authority_id?: string; state: string};
type History = {authorities: Authority[]; decisions: Decision[]; sessions?: AgentSession[]; activation_available?: boolean; persistent_available?: boolean; setups?: Setup[]};
type Feed = {history: History; actions: OutreachAction[]; replies: CaseReply[]};

const ACTIVE = ["active", "waiting", "human_required"];
const empty: Feed = {history: {authorities: [], decisions: [], sessions: [], setups: []}, actions: [], replies: []};
const when = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"});
};

async function readFeed(caseId: string, userId: string): Promise<Feed> {
  const base = `/cases/${caseId}`;
  const [history, actions, replies] = await Promise.all([
    api<History>(`${base}/autonomy`, {}, userId),
    api<unknown>(`${base}/actions`, {}, userId).catch(() => []),
    api<{replies?: unknown}>(`${base}/replies`, {}, userId).catch(() => ({replies: []})),
  ]);
  return {history, actions: Array.isArray(actions) ? actions : [], replies: Array.isArray(replies?.replies) ? replies.replies as CaseReply[] : []};
}

/** Agent status and anything it needs from you, then (after `between`) everything it has done. */
export type AutonomyParts = {status: ReactNode; activity: ReactNode; activityCount: number | null; working: boolean};
/** `render` lets the case page place the status strip and activity feed itself (full-window chat). */
export function Autonomy({caseId, userId, enabled, between, compact = false, render}: {caseId: string; userId: string; enabled: boolean; between?: ReactNode; compact?: boolean; render?: (parts: AutonomyParts) => ReactNode}) {
  const [feed, setFeed] = useState<Feed>(empty), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState("");
  const [answer, setAnswer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [savedUpdate, setSavedUpdate] = useState(false);
  const updateId = useRef(crypto.randomUUID());
  const [sentAnswer, setSentAnswer] = useState("");
  const path = `/cases/${caseId}/autonomy`;

  async function refresh() {
    try { setFeed(await readFeed(caseId, userId)); setLoaded(true); setLoadError(""); }
    catch { setLoadError("Could not refresh this case. What you see may be out of date."); }
  }
  useEffect(() => {
    let live = true;
    setLoaded(false); setFeed(empty); setLoadError(""); setError(""); setAnswer(""); setSentAnswer(""); setSavedUpdate(false); updateId.current = crypto.randomUUID();
    const read = () => readFeed(caseId, userId)
      .then(next => { if (live) { setFeed(next); setLoaded(true); setLoadError(""); } })
      .catch(() => { if (live) setLoadError("Could not refresh this case. What you see may be out of date."); });
    read();
    const timer = setInterval(read, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [caseId, userId]);

  async function run(work: () => Promise<unknown>, fallback: string) {
    setBusy(true); setError("");
    try { await work(); await refresh(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : fallback); return false; }
    finally { setBusy(false); }
  }
  const start = (e: FormEvent) => { e.preventDefault(); if (!busy) void run(() => api(path, {method: "POST", body: JSON.stringify(activationRequest(DEFAULT_INTAKE_CONSENT))}, userId), "Could not start. Refresh before trying again."); };
  const stop = (id: string) => void run(() => api(`${path}/${id}/revoke`, {method: "POST"}, userId), "Could not stop the case. Refresh to check its status.");
  const resume = (id: string) => void run(() => api(`${path}/${id}/resume`, {method: "POST", body: JSON.stringify({confirm: true})}, userId), "Could not continue the case. Refresh to check its status.");
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (busy || !answer.trim()) return;
    const text = answer.trim();
    const ok = await run(() => api(`/cases/${caseId}/updates`, {method: "POST", body: JSON.stringify({id: updateId.current, text})}, userId), "Could not save your response.");
    if (ok) { setSentAnswer(text); setAnswer(""); updateId.current = crypto.randomUUID(); setSavedUpdate(true); }
  }

  const {history, actions, replies} = feed;
  const current = history.authorities.find(a => ACTIVE.includes(a.state));
  const available = history.activation_available ?? (enabled && history.persistent_available === true);
  const sessions = history.sessions ?? [];
  const session = (current && sessions.find(s => s.authority_id === current.id)) ?? (current ? undefined : sessions[0]);
  const question = [...history.decisions].sort(byNewest).find(d => d.decision?.tool === "request_human_help")?.decision;
  const needsYou = session && ["human_required", "needs_input"].includes(session.state);
  const canMessage = session?.engine === "direct_openai" && current?.id === session.authority_id && current.policy.version !== 2;
  const working = !!current && ["running", "queued", "starting", "direct_running"].includes(session?.state ?? "queued");

  let label: string, detail: ReactNode, tone: string;
  if (session) { const s = sessionStatus(session); label = s.label; detail = session.waiting_on && ["idle", "waiting"].includes(session.state) ? `Waiting on ${session.waiting_on.replace(/^waiting (on|for) /i, "")}` : s.detail; tone = session.state; }
  else if (current) { label = "Getting started"; detail = "Assurance is reading your case. This usually takes a minute."; tone = "queued"; }
  else if (history.authorities.length) { label = "Stopped"; detail = "Assurance is not working on this case. A message that was already sending may still finish."; tone = "stopped"; }
  else { label = "Not started"; detail = "This saved case has not started yet."; tone = "idle"; }
  if (label === "Stopped" && session) detail = "Assurance is not working on this case. A message that was already sending may still finish.";

  const statusSection = <section id="section-status" className={`status-panel claim-conversation${compact ? " agent-context" : ""}`} data-tone={tone} aria-label="Case agent activation">
    {!loaded && !loadError ? <p className="quiet-line">Loading…</p> : <>
      <div className="status-head">
        {!compact && <span className="claim-orb" data-working={working} aria-hidden="true"><span/></span>}
        <h2>{label}</h2>
        {!compact && <p className="status-detail">{detail}</p>}
        {compact && !current && available && session?.state !== "completed" && <p className="status-detail agent-scope-line">Assurance will research, contact the relevant organizations, and follow up for you. You can stop it anytime.</p>}
        {current && <button className="text-button quiet-button" disabled={busy} onClick={() => stop(current.id)}>Stop agent work</button>}
        {compact && !current && available && session?.state !== "completed" && <form onSubmit={start} aria-label="Start case agent"><button disabled={busy}>{busy ? "Starting…" : "Start handling my case"}</button></form>}
      </div>
      {compact ? session?.goal && current && <details className="agent-scope"><summary>What Assurance is handling</summary><p className="status-detail">{detail}</p><p className="status-goal"><span>Goal</span><span className="status-goal-text">{session.goal}</span></p></details> : session?.goal && <p className="status-goal"><span>Goal</span><span className="status-goal-text">{session.goal}</span></p>}

      {needsYou && (!compact || current?.policy.version !== 2) && <div className="ask">
        {question && "question" in question && <div className="claim-agent-message"><span className="claim-message-label">Assurance needs a little more information</span><p className="ask-question">{question.question}</p></div>}
        {current?.id === session.authority_id && current.policy.version === 2 && <a className="text-link" href="#section-conversation">Reply in the conversation</a>}
        {sessionNeedsProviderApproval(session) && history.authorities.find(a => a.id === session.authority_id)?.policy.version !== 2 && <SessionApprovals caseId={caseId} runId={session.id} userId={userId}/>}
      </div>}

      {sentAnswer && <div className="claim-owner-message"><span className="claim-message-label">You · Update saved</span><p>{sentAnswer}</p></div>}
      {canMessage && <div className="claim-chat-input">
        <ClaimComposer value={answer} onChange={value => { setAnswer(value); setSavedUpdate(false); }} onSubmit={reply} busy={busy} needsAnswer={!!needsYou}/>
        {needsYou && <button type="button" className="text-button claim-resume" disabled={busy} onClick={() => resume(session.authority_id)}>Continue with updated information</button>}
      </div>}

      {!compact && !current && available && session?.state !== "completed" && <form onSubmit={start} aria-label="Start case agent">
        <p className="caveat">Assurance will research, contact the relevant organizations, and follow up for you. You can stop it anytime.</p>
        <button disabled={busy}>{busy ? "Starting…" : "Start handling my case"}</button>
      </form>}
      {!current && !available && session?.state !== "completed" && <p className="quiet-line">Agent work is temporarily unavailable. Your case is saved.</p>}
      {savedUpdate && <p role="status">Update saved.</p>}
      {error && <p role="alert">{error}</p>}
      {loadError && <p role="alert">{loadError}</p>}
    </>}
  </section>;
  if (render) return <>{render({status: statusSection, activity: <Activity decisions={history.decisions} actions={actions} replies={replies}/>, activityCount: loaded ? activityCount(history.decisions, replies) : null, working})}</>;
  return <>{statusSection}
  {between}
  {compact ? <details className="case-disclosure"><summary><span className="disclosure-icon" aria-hidden="true">↗</span><span>Activity log<small>Contacts, decisions, and received replies</small></span>{loaded && <span className="activity-count">{activityCount(history.decisions, replies)} {activityCount(history.decisions, replies) === 1 ? "update" : "updates"}</span>}</summary><div className="disclosure-body"><Activity decisions={history.decisions} actions={actions} replies={replies}/></div></details> : <Activity decisions={history.decisions} actions={actions} replies={replies}/>}
  </>;
}

const byNewest = (a: {created_at: string | Date}, b: {created_at: string | Date}) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
const DELIVERY: Record<string, string> = {submitted: "Sent", draft: "Sending", dispatching: "Sending", unknown: "Delivery not confirmed. It will not be resent automatically.", failed: "Not sent"};

const ACTIVITY_TOOLS = ["contact_insurer", "contact_customer", "request_human_help", "wait_for_reply", "stop_case"];
const activityCount = (decisions: Decision[], replies: CaseReply[]) => decisions.filter(d => ACTIVITY_TOOLS.includes(d.decision?.tool ?? "")).length + replies.length;

type Kind = "email" | "call" | "question" | "wait" | "closed" | "reply";
const KIND_ICON: Record<Kind, ReactNode> = {email: <Mail/>, call: <Phone/>, question: <Question/>, wait: <Clock/>, closed: <Check size={13}/>, reply: <Inbox/>};

const dayKey = (at: string | Date) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : d.toDateString(); };
function dayLabel(at: string | Date) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? {year: "numeric"} : {})});
}
const iso = (at: string | Date) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
const clock = (at: string | Date) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"}); };

// Day-grouped feed on a rail with typed markers. Layout idea from the 21st.dev
// "Activity Timeline" component by Oliver; rebuilt in plain CSS, no code copied.
function Activity({decisions, actions, replies}: {decisions: Decision[]; actions: OutreachAction[]; replies: CaseReply[]}) {
  type Item = {id: string; at: string | Date; kind: Kind; title: string; children?: ReactNode};
  const items: Item[] = [];
  for (const d of decisions) {
    const x = d.decision;
    if (!x) continue;
    if (x.tool === "contact_insurer" || x.tool === "contact_customer") {
      const action = actions.find(a => a.id === (d.action_id ?? d.id));
      const call = action?.kind === "call";
      const who = action?.destination ?? (x.tool === "contact_insurer" ? "the insurer" : "you");
      items.push({id: d.id, at: d.created_at, kind: call ? "call" : "email", title: `${call ? "Called" : "Emailed"} ${who}`, children: <>
        <p className="activity-subject">{x.subject}</p>
        {action && <p className="activity-meta" data-delivery={action.state}>{DELIVERY[action.state] ?? action.state.replaceAll("_", " ")}</p>}
        <details><summary>Show message</summary><p className="message-body">{x.body}</p></details>
      </>});
    } else if (x.tool === "request_human_help") items.push({id: d.id, at: d.created_at, kind: "question", title: "Asked you a question", children: <p>“{x.question}”</p>});
    else if (x.tool === "wait_for_reply") items.push({id: d.id, at: d.created_at, kind: "wait", title: "Waiting for a reply", children: <p className="activity-meta">{x.reason}</p>});
    else if (x.tool === "stop_case") items.push({id: d.id, at: d.created_at, kind: "closed", title: "Closed the case", children: <p>{x.summary}</p>});
  }
  for (const r of replies) items.push({id: r.id, at: r.received_at, kind: "reply", title: `Reply from ${r.sender}`, children: <>
    {r.subject && <p className="activity-subject">{r.subject}</p>}
    {r.disposition !== "accepted" && <p className="activity-meta" data-delivery="held">Held for review. Assurance has not used this message.</p>}
    <details><summary>Show message</summary><p className="message-body">{r.body || "No readable text."}</p>{r.attachment_count > 0 && <p className="activity-meta">{r.attachment_count} attachment(s) were not opened.</p>}</details>
  </>});
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const groups: {key: string; label: string; items: Item[]}[] = [];
  for (const item of items) {
    const key = dayKey(item.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item); else groups.push({key, label: dayLabel(item.at), items: [item]});
  }

  return <section id="section-activity" className="case-section activity" aria-label="Activity">
    <header className="case-section-head"><h3>Activity</h3></header>
    {items.length === 0
      ? <div className="activity-empty"><span aria-hidden="true"><Clock size={16}/></span><p>Messages Assurance sends and replies it receives will appear here.</p></div>
      : groups.map(group => <div className="activity-day" key={group.key || group.label}>
          <h4 className="activity-day-label"><span>{group.label}</span></h4>
          <ol>{group.items.map(item => <li key={item.id} id={`activity-${item.id}`} data-kind={item.kind}>
            <span className="activity-marker" aria-hidden="true">{KIND_ICON[item.kind]}</span>
            <div className="activity-body">
              <div className="activity-head"><strong>{item.title}</strong><time dateTime={iso(item.at)} title={when(item.at) ?? undefined}>{clock(item.at)}</time></div>
              {item.children}
            </div>
          </li>)}</ol>
        </div>)}
  </section>;
}
