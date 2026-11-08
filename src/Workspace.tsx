import {useCallback, useEffect, useState, type ReactNode} from "react";
import {AnimatePresence, motion} from "motion/react";
import {useLiveQuery} from "@neon/realtime-react";
import type {SealedLiveQuery} from "@neon/realtime/client";
import type {BillCase} from "../backend/schema";
import type {CaseInput} from "../backend/claim-input";
import {api, sealCases} from "./services";
import {CaseForm} from "./CaseForm";
import {Documents} from "./Documents";
import {CrewReview} from "./CrewReview";
import {ArrowLeft, ArrowUpRight, Home, LogOut, Plus, Sparkle} from "./Icons";
import {Sidebar, SidebarLink, SidebarSection, SidebarText} from "./ui/Sidebar";
import {SectionNav} from "./ui/SectionNav";
import {CaseSection} from "./ui/CaseSection";
import {NumberTicker, StatefulButton} from "./ui/motion";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number | null) => cents === null ? "Not provided" : new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance";
const gap = (item: BillCase) => item.bill_cents !== null && item.eob_cents !== null ? Math.max(0, item.bill_cents - item.eob_cents) : null;
const MONEY_CAVEAT = "To investigate — not verified savings.";

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

/** The single most useful thing to do next on a case. */
function nextStep(item: BillCase): {title: string; href: string; cta: string} {
  if (item.status === "analyzing") return {title: "We’re reviewing this case.", href: "#section-documents", cta: "Add documents"};
  if (item.case_type === "health_insurance" && (item.bill_cents === null || item.eob_cents === null)) return {title: "Add your bill and EOB amounts.", href: "#section-overview", cta: "Add amounts"};
  if (item.status === "new") return {title: "Upload your documents, then run a review.", href: "#section-documents", cta: "Add documents"};
  return {title: "Your review is ready. Draft your outreach.", href: "#section-outreach", cta: "Go to outreach"};
}

function LiveStatus({status}: {status: string}) {
  if (status === "live") return <span className="live-dot" title="Live updates connected"><span className="visually-hidden">Live updates connected</span></span>;
  return <span className="status">Live updates: {status === "connecting" ? "reconnecting…" : status}</span>;
}

export function Workspace({sealed, userId, userName, onSignOut}: {sealed: SealedLiveQuery<BillCase>; userId: string; userName: string; onSignOut: () => void}) {
  const refreshQuery = useCallback(() => sealCases(userId), [userId]);
  const {data, status, error, utils} = useLiveQuery(sealed, {refreshQuery});
  const [route, go] = useRoute();
  const [notice, setNotice] = useState("");
  const [crewEnabled, setCrewEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { api<{naive: {configured: boolean; enabledForUser: boolean}}>("/stack/status", {}, userId).then(s => setCrewEnabled(s.naive.configured && s.naive.enabledForUser)).catch(() => {}); }, [userId]);

  async function saveDetails(details: CaseInput, existing?: BillCase) {
    setBusy(existing?.id ?? "create"); setNotice("");
    try {
      const result = await api<{id: string; txid: string}>(existing ? `/cases/${existing.id}` : "/cases", {method: existing ? "PATCH" : "POST", body: JSON.stringify({...details, ...existing ? {revision: existing.revision} : {}})}, userId);
      await utils.awaitTxId(result.txid, 15000);
      if (!existing) go(`#case/${result.id}`);
    } catch (err) { setNotice(message(err)); throw err; } finally { setBusy(null); }
  }
  async function act(id: string, action: "analyze" | "delete") {
    setBusy(id); setNotice("");
    try {
      const result = await api<{txid: string}>(`/cases/${id}${action === "analyze" ? "/analyze" : ""}`, {method: action === "analyze" ? "POST" : "DELETE"}, userId);
      await utils.awaitTxId(result.txid, 15_000);
      if (action === "delete") go("#workspace");
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
  else if (showIntake) { view = <Intake hasCases={cases.length > 0} disabled={busy !== null} onCancel={() => go("#workspace")} onSave={d => saveDetails(d)} live={live}/>; viewKey = "new"; }
  else if (route.view === "case" && !selected) { view = <div className="empty"><p>This case isn’t available. It may have been deleted.</p><a className="text-link" href="#workspace">Back to all cases</a></div>; viewKey = "missing"; }
  else if (selected) { view = <CaseView key={selected.id} item={selected} userId={userId} crewEnabled={crewEnabled} busy={busy} live={live} onSave={d => saveDetails(d, selected)} onAct={action => act(selected.id, action)}/>; viewKey = `case-${selected.id}`; }
  else { view = <Overview cases={cases} userName={userName} live={live}/>; viewKey = "overview"; }

  return <div className="shell">
    <Sidebar footer={<div className="sidebar-user"><span className="avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span><SidebarText className="sidebar-user-name">{userName}</SidebarText><button className="icon-button sign-out" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div>}>
      <SidebarLink href="#workspace" icon={<Home size={20}/>} label="Overview" active={route.view === "overview" && cases.length > 0}/>
      <SidebarLink href="#new" icon={<Plus size={20}/>} label="New case" active={showIntake}/>
      <SidebarSection label={`Your cases · ${cases.length}`}/>
      {cases.map(item => <SidebarLink key={item.id} href={`#case/${item.id}`} active={selected?.id === item.id}
        icon={<span className="case-dot" data-status={item.status}>{item.title.trim().slice(0, 1).toUpperCase() || "•"}</span>}
        label={item.title} meta={item.status.replaceAll("_", " ")}/>)}
    </Sidebar>
    <main id="workspace-content" className="surface">
      {error && <p role="alert" className="error">Live updates stopped: {error.message}. Reload to reconnect.</p>}
      <AnimatePresence>{notice && <motion.p role="alert" className="error" initial={{opacity: 0, y: -6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}}>{notice}</motion.p>}</AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div key={viewKey} className="view" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}>{view}</motion.div>
      </AnimatePresence>
      <footer className="surface-footer"><span>assurance<span className="brand-period">.</span></span><small>Prototype · Synthetic data only</small></footer>
    </main>
  </div>;
}

function Greeting({name}: {name: string}) {
  const hour = new Date().getHours();
  return <>{hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, {name.split(" ")[0]}</>;
}

function Overview({cases, userName, live}: {cases: readonly BillCase[]; userName: string; live: ReactNode}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = cases.reduce((sum, c) => sum + (gap(c) ?? 0), 0);
  const reviewed = cases.filter(c => c.status === "reviewed").length;
  const focus = cases.find(c => c.status !== "reviewed") ?? cases[0];
  const step = focus && nextStep(focus);
  return <>
    <div className="page-head">
      <div><p className="eyebrow"><Greeting name={userName}/></p><h1>Your cases</h1></div>
      {live}
    </div>

    {focus && step && <div className="next-step">
      <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
      <div><h2>{step.title}</h2><p>{focus.title}</p></div>
      <a className="pill-link" href={`#case/${focus.id}`}>Open case <ArrowUpRight size={15} aria-hidden="true"/></a>
    </div>}

    <div className="summary-strip">
      <div className="summary-money"><strong><NumberTicker value={total} format={n => money(Math.round(n))}/></strong><small>{MONEY_CAVEAT}</small></div>
      <div className="summary-meta">
        <span><b>{cases.length}</b> open</span>
        <span><b>{reviewed}</b> of {cases.length} reviewed</span>
        <span className="stat-meter" aria-hidden="true"><motion.span initial={{scaleX: 0}} animate={{scaleX: cases.length ? reviewed / cases.length : 0}} transition={{duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15}}/></span>
      </div>
    </div>

    <div className="case-grid" onMouseLeave={() => setHovered(null)}>
      {cases.map((item, i) => {
        const diff = gap(item);
        return <a key={item.id} href={`#case/${item.id}`} className="case-tile" onMouseEnter={() => setHovered(i)} onFocus={() => setHovered(i)}>
          <AnimatePresence>{hovered === i && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: 0.15}}} exit={{opacity: 0, transition: {duration: 0.15, delay: 0.1}}}/>}</AnimatePresence>
          <span className="case-tile-inner">
            <span className="case-tile-top"><span className="case-tile-kind">{caseKind(item)}</span><span className="badge" data-status={item.status}>{item.status.replaceAll("_", " ")}</span></span>
            <strong className="case-tile-title">{item.title}</strong>
            {(item.intake?.injury_description || item.notes) && <span className="case-tile-desc">{item.intake?.injury_description || item.notes}</span>}
            <span className="case-tile-foot"><span>{diff === null ? "Amounts not added" : <><b>{money(diff)}</b> to investigate</>}</span><ArrowUpRight size={16} aria-hidden="true"/></span>
          </span>
        </a>;
      })}
      <a href="#new" className="case-tile case-tile--new" onMouseEnter={() => setHovered(cases.length)}>
        <AnimatePresence>{hovered === cases.length && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}/>}</AnimatePresence>
        <span className="case-tile-inner"><span className="new-plus" aria-hidden="true"><Plus size={22}/></span><strong className="case-tile-title">Open a new case</strong></span>
      </a>
    </div>
  </>;
}

function Intake({hasCases, disabled, onCancel, onSave, live}: {hasCases: boolean; disabled: boolean; onCancel: () => void; onSave: (d: CaseInput) => Promise<void>; live: ReactNode}) {
  return <>
    <div className="page-head">
      <div>{hasCases && <button className="back-link" onClick={onCancel}><ArrowLeft size={16} aria-hidden="true"/>All cases</button>}<h1>{hasCases ? "Open a new case." : "Open your first case."}</h1><p className="lede">Use made-up details only — this is a prototype.</p></div>
      {live}
    </div>
    <div className="intake-card"><CaseForm disabled={disabled} onSave={onSave}/></div>
  </>;
}

const SECTIONS = [
  {id: "section-overview", label: "Overview"},
  {id: "section-documents", label: "Documents"},
  {id: "section-review", label: "Review"},
  {id: "section-outreach", label: "Outreach"},
  {id: "section-outcomes", label: "Outcomes"},
];

function CaseView({item, userId, crewEnabled, busy, live, onSave, onAct}: {item: BillCase; userId: string; crewEnabled: boolean; busy: string | null; live: ReactNode; onSave: (d: CaseInput) => Promise<void>; onAct: (action: "analyze" | "delete") => Promise<boolean>}) {
  const [editing, setEditing] = useState(false);
  const diff = gap(item);
  const step = nextStep(item);
  const max = Math.max(item.bill_cents ?? 0, item.eob_cents ?? 0, 1);
  const bothKnown = item.bill_cents !== null && item.eob_cents !== null;
  const facts = [
    ["Insurer", item.intake?.insurer_name], ["Employer", item.intake?.employer_name], ["Claim number", item.intake?.claim_number],
    ["Incident date", item.intake?.incident_date],
    ["Claim stage", item.intake?.claim_stage && item.intake.claim_stage !== "unknown" ? item.intake.claim_stage.replaceAll("_", " ") : undefined],
    ["Jurisdiction", item.intake?.jurisdiction],
  ].filter((f): f is [string, string] => !!f[1]);
  const openEditor = () => { setEditing(true); document.getElementById("section-overview")?.scrollIntoView({behavior: "smooth"}); };
  return <article className="case" data-case-id={item.id}>
    <div className="page-head">
      <div>
        <a className="back-link" href="#workspace"><ArrowLeft size={16} aria-hidden="true"/>All cases</a>
        <p className="eyebrow">{caseKind(item)}{item.intake?.claim_number ? ` · Claim ${item.intake.claim_number}` : ""}</p>
        <div className="case-title-row"><h1>{item.title}</h1><span className="badge" data-status={item.status}>{item.status.replaceAll("_", " ")}</span>{live}</div>
      </div>
      <div className="actions">
        <StatefulButton className={item.status === "reviewed" ? "secondary" : "primary"} disabled={busy !== null || item.status === "analyzing"} onAction={() => onAct("analyze")}>Review with AI</StatefulButton>
        <button className="text-button quiet-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void onAct("delete"); }}>Delete</button>
      </div>
    </div>

    <div className="case-hero">
      <div className="next-step">
        <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
        <div><h2>{step.title}</h2></div>
        <a className="pill-link" href={step.href} onClick={e => { e.preventDefault(); if (step.href === "#section-overview") openEditor(); else document.getElementById(step.href.slice(1))?.scrollIntoView({behavior: "smooth"}); }}>{step.cta}<ArrowUpRight size={15} aria-hidden="true"/></a>
      </div>
      {bothKnown
        ? <div className="money-card">
            <p className="discrepancy">Potential discrepancy <b>{money(diff)}</b></p>
            <div className="money-row"><span>Bill</span><span>{money(item.bill_cents)}</span></div>
            <span className="bar" aria-hidden="true"><motion.span className="bar-fill bar-fill--bill" initial={{scaleX: 0}} animate={{scaleX: (item.bill_cents ?? 0) / max}} transition={{duration: 0.8, ease: [0.16, 1, 0.3, 1]}}/></span>
            <div className="money-row"><span>EOB responsibility</span><span>{money(item.eob_cents)}</span></div>
            <span className="bar" aria-hidden="true"><motion.span className="bar-fill" initial={{scaleX: 0}} animate={{scaleX: (item.eob_cents ?? 0) / max}} transition={{duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}/></span>
            <small>{MONEY_CAVEAT}</small>
          </div>
        : <div className="money-card money-card--empty">
            <p>{item.bill_cents === null && item.eob_cents === null ? "No amounts yet." : item.bill_cents === null ? `EOB responsibility ${money(item.eob_cents)} · bill missing` : `Bill ${money(item.bill_cents)} · EOB missing`}</p>
            <button className="text-button" onClick={openEditor}>Add bill and EOB amounts</button>
          </div>}
    </div>

    <SectionNav sections={SECTIONS}/>

    <CaseSection id="section-overview" title="Overview" aside={<button className="text-button" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? "Cancel editing" : "Update case details"}</button>}>
      <AnimatePresence initial={false}>
        {editing && <motion.div className="edit-panel" initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}>
          <p className="caveat">Changes need a new review before outreach.</p>
          <CaseForm key={`${item.id}-${item.revision}`} initial={item} disabled={busy !== null} onSave={async d => { await onSave(d); setEditing(false); }}/>
        </motion.div>}
      </AnimatePresence>
      {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {item.intake?.injury_description ? <p className="story-text">{item.intake.injury_description}</p> : <p className="quiet-line">No description yet.</p>}
      {item.notes && <p className="notes">{item.notes}</p>}
    </CaseSection>

    <CaseSection id="section-documents" title="Documents">
      <Documents key={`documents-${item.id}`} caseId={item.id} userId={userId} revision={item.revision} enabled={crewEnabled}/>
    </CaseSection>

    <CrewReview key={`${item.id}-${item.revision}`} revision={item.revision} id={item.id} userId={userId} enabled={crewEnabled} quickAnalysis={item.analysis}/>
  </article>;
}
