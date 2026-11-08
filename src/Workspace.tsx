import {phoneSelected} from './phone-session';
import {OnboardingCallNotice} from './phone-onboarding';
import {GmailConnection} from './GmailConnection';
import {EmailLeads} from "./EmailLeads";
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import {AnimatePresence, motion} from "motion/react";
import {useLiveQuery} from "@neon/realtime-react";
import type {SealedLiveQuery} from "@neon/realtime/client";
import type {BillCase} from "../backend/schema";
import type {CaseInput} from "../backend/claim-input";
import {api, sealCases} from "./services";
import {CaseForm} from "./CaseForm";
import {Documents} from "./Documents";
import {CaseChat} from "./CaseChat";
import {Autonomy} from "./Autonomy";
import {Outcomes} from "./Outcomes";
import {ArrowLeft, Home, LogOut, Plus} from "./Icons";
import {Sidebar, SidebarLink, SidebarSection, SidebarText} from "./ui/Sidebar";
import {Overview} from "./Overview";

export {Overview};

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number) => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance";

type Route = {view: "overview"} | {view: "new"} | {view: "case"; id: string};
function readRoute(): Route {
  const hash = window.location.hash;
  if (hash === "#new") return {view: "new"};
  const match = hash.match(/^#case\/([\w-]+)/);
  return match ? {view: "case", id: match[1]} : {view: "overview"};
}
function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = (hash: string) => { if (window.location.hash !== hash) window.location.hash = hash; window.scrollTo({top: 0}); };
  return [route, go] as const;
}

function LiveStatus({status}: {status: string}) {
  if (status === "live") return <span className="visually-hidden">Live updates connected</span>;
  return <span className="status">{status === "connecting" ? "Reconnecting…" : `Live updates ${status}`}</span>;
}

export function Workspace({sealed, userId, userName, onSignOut}: {sealed: SealedLiveQuery<BillCase>; userId: string; userName: string; onSignOut: () => void}) {
  const refreshQuery = useCallback(() => sealCases(userId), [userId]);
  const {data, status, error, utils} = useLiveQuery(sealed, {refreshQuery});
  const [route, go] = useRoute();
  const [notice, setNotice] = useState("");
  const createId=useRef(crypto.randomUUID());
  const [crewEnabled, setCrewEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { api<{naive: {configured: boolean; enabledForUser: boolean}}>("/stack/status", {}, userId).then(s => setCrewEnabled(s.naive.configured && s.naive.enabledForUser)).catch(() => {}); }, [userId]);

  async function saveDetails(details: CaseInput, existing?: BillCase, files:File[] = []) {
    setBusy(existing?.id ?? "create"); setNotice("");
    try {
      const result = await api<{id: string; txid: string}>(existing ? `/cases/${existing.id}` : "/cases", {method: existing ? "PATCH" : "POST", body: JSON.stringify({...details, ...existing ? {revision: existing.revision} : {id:createId.current,start_agent:true}})}, userId);
      if(!existing)createId.current=crypto.randomUUID();
      if (!existing) go(`#case/${result.id}`);
      await utils.awaitTxId(result.txid, 15000).catch(()=>setNotice("Your changes are saved. Live updates are reconnecting."));
      for(const file of files){
        const body=new FormData();body.set("file",file);body.set("kind","other");const documentId=crypto.randomUUID();body.set("id",documentId);
        try{await api(`/cases/${result.id}/documents`,{method:"POST",body},userId);await api(`/cases/${result.id}/documents/${documentId}/extraction`,{method:"POST"},userId);}
        catch{setNotice(`Your case is saved and queued. ${file.name} could not finish processing; check Documents below before retrying.`);}
      }
    } catch (err) { setNotice(message(err)); throw err; } finally { setBusy(null); }
  }
  async function remove(id: string) {
    setBusy(id); setNotice("");
    try {
      const result = await api<{txid: string}>(`/cases/${id}`, {method: "DELETE"}, userId);
      await utils.awaitTxId(result.txid, 15_000);
      go("#workspace");
      return true;
    } catch (err) { setNotice(message(err)); return false; } finally { setBusy(null); }
  }

  const cases = data ?? [];
  const selected = route.view === "case" ? cases.find(c => c.id === route.id) : undefined;
  const showIntake = data !== undefined && (route.view === "new" || cases.length === 0);
  const live = <LiveStatus status={status}/>;

  let view: ReactNode;
  let viewKey: string;
  if (data === undefined) { view = <p role="status" className="loading-line">Connecting to your cases…</p>; viewKey = "loading"; }
  else if (showIntake) { view = <Intake hasCases={cases.length > 0} disabled={busy !== null} userId={userId} onCancel={() => go("#workspace")} onSave={(d,files) => saveDetails(d,undefined,files)} live={live}/>; viewKey = "new"; }
  else if (route.view === "case" && !selected) { view = <div className="empty"><p>This case isn’t available. It may have been deleted.</p><a className="text-link" href="#workspace">Back to all cases</a></div>; viewKey = "missing"; }
  else if (selected) { view = <CaseView key={selected.id} item={selected} userId={userId} crewEnabled={crewEnabled} busy={busy} live={live} onSave={d => saveDetails(d, selected)} onAct={() => remove(selected.id)}/>; viewKey = `case-${selected.id}`; }
  else { view = <Overview cases={cases} userId={userId} userName={userName} crewEnabled={crewEnabled} live={live}/>; viewKey = "overview"; }

  return <div className="shell">
    <Sidebar footer={<div className="sidebar-user"><span className="avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span><SidebarText className="sidebar-user-name">{userName}</SidebarText><button className="icon-button sign-out" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div>}>
      <SidebarLink href="#workspace" icon={<Home size={20}/>} label="Overview" active={route.view === "overview" && cases.length > 0}/>
      <SidebarLink href="#new" icon={<Plus size={20}/>} label="New case" active={showIntake}/>
      <SidebarSection label={`Your cases · ${cases.length}`}/>
      {cases.map(item => <SidebarLink key={item.id} href={`#case/${item.id}`} active={selected?.id === item.id}
        icon={<span className="case-dot" data-status={item.status}>{item.title.trim().slice(0, 1).toUpperCase() || "•"}</span>}
        label={item.title}/>)}
    </Sidebar>
    <main id="workspace-content" className="surface">
      {phoneSelected()&&<OnboardingCallNotice userId={userId}/>}
      {!phoneSelected()&&route.view!=="case"&&<EmailLeads userId={userId} onOpen={id=>go(`#case/${id}`)}/>}
      {error && <p role="alert" className="error">Live updates stopped: {error.message}. Reload to reconnect.</p>}
      <AnimatePresence>{notice && <motion.p role="alert" className="error" initial={{opacity: 0, y: -6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}}>{notice}</motion.p>}</AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div key={viewKey} className="view" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}>{view}</motion.div>
      </AnimatePresence>
    </main>
  </div>;
}

function CallForNewCase({userId}: {userId: string}) {
  const [info, setInfo] = useState<{call_number?: string; last_call?: {state: string; reason: string | null} | null} | null>(null);
  useEffect(() => {
    let active = true;
    const read = () => api<NonNullable<typeof info>>("/phone/onboarding", {}, userId).then(result => { if (active) setInfo(result); }).catch(() => {});
    void read();
    const timer = setInterval(() => void read(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [userId]);
  const number = info?.call_number;
  return <div className="intake-card new-case-call">
    <h2>Call us to open it</h2>
    <p>Call from this phone and say you want a new case. Tell us what happened, and it opens here after you hang up.</p>
    {number && <a className="primary-link" href={`tel:${number}`}>{number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}</a>}
    {info?.last_call?.state === "needs_information" && info.last_call.reason && <p role="status">{info.last_call.reason}</p>}
  </div>;
}

function Intake({hasCases, disabled, userId, onCancel, onSave, live}: {hasCases: boolean; disabled: boolean; userId: string; onCancel: () => void; onSave: (d: CaseInput,files?:File[]) => Promise<void>; live: ReactNode}) {
  return <>
    <div className="page-head">
      <div>{hasCases && <button className="back-link" onClick={onCancel}><ArrowLeft size={16} aria-hidden="true"/>All cases</button>}<h1>{hasCases ? "Open a new case." : phoneSelected() ? "Your cases" : "Open your first case."}</h1><p className="lede">{phoneSelected() ? "No forms. Just call." : "Tell us what happened or upload your documents. Assurance takes it from there."}</p></div>
      {live}
    </div>
    {phoneSelected() ? <CallForNewCase userId={userId}/> : <div className="intake-card"><CaseForm disabled={disabled} onSave={onSave}/></div>}
  </>;
}

export function CaseView({item, userId, crewEnabled, busy, live, onSave, onAct}: {item: BillCase; userId: string; crewEnabled: boolean; busy: string | null; live: ReactNode; onSave: (d: CaseInput) => Promise<void>; onAct: (action: "delete") => Promise<boolean>}) {
  const diff = item.bill_cents !== null && item.eob_cents !== null ? Math.max(0, item.bill_cents - item.eob_cents) : null;
  const [editing, setEditing] = useState(false);
  const i = item.intake;
  const facts = [
    ["Insurer", i?.insurer_name], ["Employer", i?.employer_name], ["Claim number", i?.claim_number], ["Member ID", i?.member_id],
    ["Incident date", i?.incident_date], ["State", i?.jurisdiction],
    ["Claim stage", i?.claim_stage && i.claim_stage !== "unknown" ? i.claim_stage.replaceAll("_", " ") : undefined],
    ["Bill amount", item.bill_cents !== null ? money(item.bill_cents) : undefined],
    ["EOB responsibility", item.eob_cents !== null ? money(item.eob_cents) : undefined],
  ].filter((f): f is [string, string] => !!f[1]);
  return <article className="case" data-case-id={item.id}>
    <div className="page-head">
      <div>
        <a className="back-link" href="#workspace"><ArrowLeft size={16} aria-hidden="true"/>All cases</a>
        <p className="eyebrow">{caseKind(item)}{i?.claim_number ? ` · Claim ${i.claim_number}` : ""}</p>
        <h1>{item.title}</h1>
      </div>
      <div className="actions">
        {live}
        <button className="text-button quiet-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void onAct("delete"); }}>Delete</button>
      </div>
    </div>

    {phoneSelected() && <dl className="case-key-numbers" aria-label="Key amounts">
      {([["Bill", item.bill_cents], ["EOB", item.eob_cents], ["Possible discrepancy", diff]] as const).map(([label, cents]) =>
        <div key={label}><dt>{label}</dt><dd>{cents === null ? "—" : money(cents)}</dd></div>)}
    </dl>}

    <Autonomy key={item.id} caseId={item.id} userId={userId} enabled={crewEnabled} between={<>
      <section id="section-conversation" className="case-section" aria-label="Conversation">
        <header className="case-section-head"><h3>Conversation</h3></header>
        <CaseChat key={`chat-${item.id}-${userId}`} caseId={item.id} userId={userId} revision={item.revision}/>
      </section>
      <Outcomes caseId={item.id} userId={userId} revision={item.revision}/>
    </>}/>

    {!phoneSelected() && <GmailConnection key={`gmail-${item.id}`} caseId={item.id} userId={userId}/>}

    <Documents key={`documents-${item.id}`} caseId={item.id} userId={userId} revision={item.revision}/>

    <section id="section-details" className="case-section" aria-label="Case details">
      <header className="case-section-head"><h3>Details</h3><button className="text-button" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? "Cancel" : "Edit details"}</button></header>
      <AnimatePresence initial={false}>
        {editing && <motion.div className="edit-panel" initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}>
          <CaseForm key={`${item.id}-${item.revision}`} initial={item} disabled={busy !== null} onSave={async d => { await onSave(d); setEditing(false); }}/>
        </motion.div>}
      </AnimatePresence>
      {i?.injury_description ? <p className="story-text">{i.injury_description}</p> : <p className="quiet-line">No description yet.</p>}
      {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {item.notes && <p className="notes">{item.notes}</p>}
    </section>
  </article>;
}
