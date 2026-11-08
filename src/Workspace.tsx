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
import {CaseDocumentsProvider, Documents} from "./Documents";
import {CaseChat} from "./CaseChat";
import {Autonomy} from "./Autonomy";
import {Outcomes} from "./Outcomes";
import {ArrowLeft, Close, Home, Info, LogOut, Plus, User} from "./Icons";
import {isPersonName} from "./format";
import {Sidebar, SidebarLink, SidebarSection, SidebarText} from "./ui/Sidebar";
import {Overview} from "./Overview";
import {ClaimProgress} from "./ui/ClaimProgress";
import {useProgressMap} from "./progress";
import "./claim-workspace.css";

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
    <Sidebar footer={<div className="sidebar-user"><span className="avatar" aria-hidden="true">{isPersonName(userName) ? userName.trim().slice(0, 1).toUpperCase() : <User size={18}/>}</span><SidebarText className="sidebar-user-name">{userName}</SidebarText><button className="icon-button sign-out" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div>}>
      <SidebarLink href="#workspace" icon={<Home size={20}/>} label="Overview" active={route.view === "overview" && cases.length > 0}/>
      <SidebarLink href="#new" icon={<Plus size={20}/>} label="New case" active={showIntake}/>
      <SidebarSection label={`Your cases · ${cases.length}`}/>
      {cases.map(item => <SidebarLink key={item.id} href={`#case/${item.id}`} active={selected?.id === item.id}
        icon={<span className="case-dot" data-status={item.status}>{item.title.trim().slice(0, 1).toUpperCase() || "•"}</span>}
        label={item.title}/>)}
    </Sidebar>
    <main id="workspace-content" className="surface">
      {phoneSelected()&&route.view!=="case"&&<OnboardingCallNotice userId={userId}/>}
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

/** One case as a single chat card. Everything a person rarely needs lives in the Case info sheet. */
export function CaseView({item, userId, crewEnabled, busy, live, onSave, onAct}: {item: BillCase; userId: string; crewEnabled: boolean; busy: string | null; live: ReactNode; onSave: (d: CaseInput) => Promise<void>; onAct: (action: "delete") => Promise<boolean>}) {
  const [editing, setEditing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null), openRef = useRef<HTMLButtonElement>(null);
  const i = item.intake;
  const facts = [
    ["Insurer", i?.insurer_name], ["Employer", i?.employer_name], ["Claim number", i?.claim_number], ["Member ID", i?.member_id],
    ["Date it happened", i?.incident_date], ["State", i?.jurisdiction],
    ["Bill amount", item.bill_cents !== null ? money(item.bill_cents) : undefined],
    ["Insurer says you owe", item.eob_cents !== null ? money(item.eob_cents) : undefined],
  ].filter((f): f is [string, string] => !!f[1]);
  const progress = useProgressMap([item], userId, crewEnabled).get(item.id);
  // On phones the Case info sheet is a full-screen bottom sheet that slides up from the screen edge.
  const phoneSheet = typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;
  useEffect(() => {
    if (!infoOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInfoOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); openRef.current?.focus({preventScroll: true}); };
  }, [infoOpen]);

  return <CaseDocumentsProvider key={`${item.id}-${userId}`} caseId={item.id} userId={userId} revision={item.revision}><article className="case claim-workspace claim-chat-page" data-case-id={item.id}>
    <Autonomy key={item.id} caseId={item.id} userId={userId} enabled={crewEnabled} compact render={({status, activity, canStart, started, start, busy: starting, error}) => <section id="section-conversation" className="chat-card-wrap" aria-label="Conversation">
      <CaseChat key={`chat-${item.id}-${userId}`} caseId={item.id} userId={userId} revision={item.revision} title={item.title} pausedNote={!canStart} fallbackStatus={progress?.loaded ? {label: progress.title, owner: progress.owner} : undefined}
        headerStart={<a className="chat-round back-link" href="#workspace" aria-label="All cases" title="All cases"><ArrowLeft size={16} aria-hidden="true"/></a>}
        headerEnd={<motion.button ref={openRef} type="button" className="chat-round chat-info" onClick={() => setInfoOpen(true)} aria-label="Case info" title="Case info" aria-haspopup="dialog" aria-expanded={infoOpen} whileTap={{scale: 0.9}}>
          <Info size={16} aria-hidden="true"/><span className="chat-info-label">Case info</span>{progress?.outcome && <span className="chat-round-dot" aria-hidden="true"/>}
        </motion.button>}
        beforeCompose={<>{live}{canStart && <div className="chat-start">
          <p className="chat-start-text">{started ? "Assurance is paused on this case. Your messages are saved, but nothing more happens until you start again." : "Assurance hasn’t started on this case yet. We’ll research it, contact the right people and follow up for you. You can stop anytime."}</p>
          <button type="button" onClick={start} disabled={starting}>{starting ? "Starting…" : started ? "Start again" : "Start handling my case"}</button>
          {error && <p role="alert">{error}</p>}
        </div>}</>}>
        <AnimatePresence>{infoOpen && <motion.div key="info" className="chat-sheet-layer" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.2}}>
          <div className="chat-sheet-backdrop" onClick={() => setInfoOpen(false)} aria-hidden="true"/>
          <motion.div className="chat-sheet" role="dialog" aria-modal="true" aria-labelledby="chat-sheet-title"
            initial={phoneSheet ? {y: "100%"} : {y: 24, opacity: 0}} animate={{y: 0, opacity: 1}} exit={phoneSheet ? {y: "100%"} : {y: 24, opacity: 0}} transition={{type: "spring", bounce: phoneSheet ? 0 : 0.15, duration: phoneSheet ? 0.38 : 0.45}}>
            <span className="chat-sheet-grab" aria-hidden="true"/>
            <header className="chat-sheet-head">
              <div><h2 id="chat-sheet-title">Case info</h2><p>{caseKind(item)}</p></div>
              <button ref={closeRef} type="button" className="chat-round" onClick={() => setInfoOpen(false)} aria-label="Close case info"><Close size={16}/></button>
            </header>
            <div className="chat-sheet-body">
              <section className="sheet-block" aria-label="Where things stand"><h3>Where things stand</h3><ClaimProgress progress={progress}/></section>
              {progress?.outcome && <section className="sheet-block"><h3>Result</h3><Outcomes caseId={item.id} userId={userId} revision={item.revision}/></section>}
              <section className="sheet-block"><h3>Your documents</h3><Documents bare/></section>
              <section className="sheet-block"><h3>What we’ve done</h3>{activity}</section>
              <section className="sheet-block chat-panel-details" aria-label="Your details">
                <header className="sheet-block-head"><h3>Your details</h3><button className="text-button" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? "Cancel" : "Edit"}</button></header>
                <AnimatePresence initial={false}>
                  {editing && <motion.div className="edit-panel" initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}>
                    <CaseForm key={`${item.id}-${item.revision}`} initial={item} disabled={busy !== null} onSave={async d => { await onSave(d); setEditing(false); }}/>
                  </motion.div>}
                </AnimatePresence>
                {i?.injury_description ? <p className="story-text">{i.injury_description}</p> : <p className="quiet-line">No description yet.</p>}
                {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
                {!phoneSelected() && <GmailConnection key={`gmail-${item.id}`} caseId={item.id} userId={userId}/>}
              </section>
              <section className="sheet-block sheet-controls"><h3>Assurance’s work</h3>{status}
                <button className="text-button quiet-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void onAct("delete"); }}>Delete case</button>
              </section>
            </div>
          </motion.div>
        </motion.div>}</AnimatePresence>
      </CaseChat>
    </section>}/>
  </article></CaseDocumentsProvider>;
}
