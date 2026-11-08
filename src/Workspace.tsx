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
import {ArrowLeft, ArrowUpRight, Home, LogOut, Plus} from "./Icons";
import {Sidebar, SidebarLink, SidebarSection, SidebarText} from "./ui/Sidebar";
import {OWNER_LABEL, useProgressMap} from "./progress";
import {NumberTicker} from "./ui/motion";

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
  else if (showIntake) { view = <Intake hasCases={cases.length > 0} disabled={busy !== null} onCancel={() => go("#workspace")} onSave={(d,files) => saveDetails(d,undefined,files)} live={live}/>; viewKey = "new"; }
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

function Greeting({name}: {name: string}) {
  const hour = new Date().getHours();
  return <>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {name.split(" ")[0]}</>;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function Overview({cases, userId, userName, crewEnabled, live}: {cases: readonly BillCase[]; userId: string; userName: string; crewEnabled: boolean; live: ReactNode}) {
  const progress = useProgressMap(cases, userId, crewEnabled);
  const [hovered, setHovered] = useState<string | null>(null);
  const all = cases.map(c => progress.get(c.id));
  const needYou = all.filter(p => p?.loaded && p.owner === "you").length;
  const saved = all.reduce((sum, p) => sum + (p?.outcome?.reduction_cents ?? 0), 0);
  return <>
    <div className="page-head">
      <div><p className="eyebrow"><Greeting name={userName}/></p><h1>Your cases</h1></div>
      {live}
    </div>
    <motion.div className="overview-stats" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, ease}}>
      <div><span>Open cases</span><strong>{cases.length}</strong></div>
      <div data-alert={needYou > 0}><span>Need you</span><strong>{needYou}</strong></div>
      <div className="overview-savings"><span>Reported savings</span><strong>{saved ? <NumberTicker value={saved} format={n => money(Math.round(n))}/> : "Not yet known"}</strong><small>{saved ? "From recorded insurer decisions. Not a verified payout." : "Shows up once an insurer decision is recorded."}</small></div>
    </motion.div>
    <div className="case-grid" onMouseLeave={() => setHovered(null)}>
      {cases.map((item, i) => {
        const p = progress.get(item.id);
        return <motion.a key={item.id} href={`#case/${item.id}`} className="case-tile" onMouseEnter={() => setHovered(item.id)} onFocus={() => setHovered(item.id)}
          initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{duration: 0.45, delay: 0.06 * i, ease}}>
          <AnimatePresence>{hovered === item.id && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: 0.15}}} exit={{opacity: 0, transition: {duration: 0.15, delay: 0.1}}}/>}</AnimatePresence>
          <span className="case-tile-inner" data-owner={p?.loaded ? p.owner : undefined}>
            <span className="case-tile-top"><span className="case-tile-kind">{caseKind(item)}</span>{p?.loaded && <span className="badge" data-owner={p.owner}><span className="badge-dot"/>{OWNER_LABEL[p.owner]}</span>}</span>
            <strong className="case-tile-title">{item.title}</strong>
            <span className="case-tile-foot"><span className="case-tile-desc">{p?.loaded ? p.title : " "}</span><ArrowUpRight size={16} aria-hidden="true"/></span>
          </span>
        </motion.a>;
      })}
      <motion.a href="#new" className="case-tile case-tile--new" onMouseEnter={() => setHovered("new")}
        initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{duration: 0.45, delay: 0.06 * cases.length, ease}}>
        <AnimatePresence>{hovered === "new" && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}/>}</AnimatePresence>
        <span className="case-tile-inner"><span className="new-plus" aria-hidden="true"><Plus size={20}/></span><strong>Open a new case</strong></span>
      </motion.a>
    </div>
  </>;
}

function Intake({hasCases, disabled, onCancel, onSave, live}: {hasCases: boolean; disabled: boolean; onCancel: () => void; onSave: (d: CaseInput,files?:File[]) => Promise<void>; live: ReactNode}) {
  return <>
    <div className="page-head">
      <div>{hasCases && <button className="back-link" onClick={onCancel}><ArrowLeft size={16} aria-hidden="true"/>All cases</button>}<h1>{hasCases ? "Open a new case." : phoneSelected() ? "Your cases" : "Open your first case."}</h1><p className="lede">{phoneSelected()&&!hasCases ? "Your cases will appear here. You can add details and documents below." : "Tell us what happened or upload your documents. Assurance takes it from there."}</p></div>
      {live}
    </div>
    {phoneSelected()&&!hasCases ? <details className="intake-card"><summary>Add case details yourself (optional)</summary><CaseForm disabled={disabled} onSave={onSave}/></details> : <div className="intake-card"><CaseForm disabled={disabled} onSave={onSave}/></div>}
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

    {phoneSelected() && <dl className="case-key-numbers" aria-label="Key amounts"><div><dt>Bill amount</dt><dd>{item.bill_cents === null ? "Not yet known" : money(item.bill_cents)}</dd></div><div><dt>EOB responsibility</dt><dd>{item.eob_cents === null ? "Not yet known" : money(item.eob_cents)}</dd></div><div><dt>Estimated discrepancy</dt><dd>{diff === null ? "Not yet known" : money(diff)}</dd><small>To investigate · not verified savings</small></div></dl>}

    <Autonomy caseId={item.id} userId={userId} enabled={crewEnabled} between={<>
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
