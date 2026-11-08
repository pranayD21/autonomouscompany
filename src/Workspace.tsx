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
import {NumberTicker, Reveal, StatefulButton, TextGenerate} from "./ui/motion";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number | null) => cents === null ? "Not provided" : new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health-insurance dispute";
const gap = (item: BillCase) => item.bill_cents !== null && item.eob_cents !== null ? Math.max(0, item.bill_cents - item.eob_cents) : null;

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
function nextStep(item: BillCase): {title: string; body: string; href: string; cta: string} {
  if (item.status === "analyzing") return {title: "We’re reviewing your case.", body: "This usually takes a minute. You can keep adding documents while you wait.", href: "#section-documents", cta: "Add documents"};
  if (item.case_type === "health_insurance" && (item.bill_cents === null || item.eob_cents === null)) return {title: "Add your bill and EOB amounts.", body: "With both numbers we can show what you may be overcharged. Leave anything you don’t know blank.", href: "#section-overview", cta: "Update details"};
  if (item.status === "new") return {title: "Get a first review.", body: "Upload what you have, then let the agent team draft the questions worth asking.", href: "#section-documents", cta: "Start with documents"};
  return {title: "Decide on outreach.", body: "Your review is in. Draft an email or call plan and authorize it when you’re ready.", href: "#section-outreach", cta: "Go to outreach"};
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
  const live = <span className="status" data-live={status === "live"}>{status === "live" ? "Live updates connected" : `Live updates: ${status}`}</span>;

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
        <motion.div key={viewKey} className="view" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={{duration: 0.28, ease: [0.16, 1, 0.3, 1]}}>{view}</motion.div>
      </AnimatePresence>
      <footer className="surface-footer"><span>assurance<span className="brand-period">.</span></span><span>On your side. Not in your way.</span><small>Prototype · Synthetic data only</small></footer>
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
      <div><p className="eyebrow"><Greeting name={userName}/></p><TextGenerate as="h1" text="Your claims. Under control."/></div>
      {live}
    </div>
    <p className="demo-note">Prototype workspace. Use synthetic injury, insurance, and billing details only. Outreach requires an approved test operator, an approved recipient, and explicit authorization. No claims are submitted.</p>

    <div className="stats">
      {[
        {label: "Open cases", value: <NumberTicker value={cases.length} format={n => String(Math.round(n))}/>, note: `${cases.filter(c => c.case_type === "health_insurance").length} insurance · ${cases.filter(c => c.case_type === "workplace_injury").length} injury`},
        {label: "To investigate", value: <NumberTicker value={total} format={n => money(Math.round(n))}/>, note: "Billed minus EOB responsibility. Not verified savings."},
        {label: "Reviewed", value: <><NumberTicker value={reviewed} format={n => String(Math.round(n))}/><span className="stat-of"> / {cases.length}</span></>, note: reviewed === cases.length ? "Every case has a review." : "Cases with a completed AI review."},
      ].map((stat, i) => <Reveal as="div" key={stat.label} delay={i * 0.06} className="stat"><p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.note}</small>
        {stat.label === "Reviewed" && <span className="stat-meter" aria-hidden="true"><motion.span initial={{scaleX: 0}} animate={{scaleX: cases.length ? reviewed / cases.length : 0}} transition={{duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2}}/></span>}
      </Reveal>)}
    </div>

    {focus && step && <Reveal as="div" delay={0.15} className="next-step">
      <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
      <div><p className="eyebrow">Next step · {focus.title}</p><h2>{step.title}</h2><p>{step.body}</p></div>
      <a className="pill-link" href={`#case/${focus.id}`}>Open case <ArrowUpRight size={15} aria-hidden="true"/></a>
    </Reveal>}

    <div className="section-row"><h2>Your cases</h2><a className="text-link" href="#new">Open a case <Plus size={14} aria-hidden="true"/></a></div>
    <div className="case-grid" onMouseLeave={() => setHovered(null)}>
      {cases.map((item, i) => {
        const diff = gap(item);
        return <a key={item.id} href={`#case/${item.id}`} className="case-tile" onMouseEnter={() => setHovered(i)} onFocus={() => setHovered(i)}>
          <AnimatePresence>{hovered === i && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: 0.15}}} exit={{opacity: 0, transition: {duration: 0.15, delay: 0.1}}}/>}</AnimatePresence>
          <span className="case-tile-inner">
            <span className="case-tile-top"><span className="eyebrow">{caseKind(item)}</span><span className="badge" data-status={item.status}>{item.status.replaceAll("_", " ")}</span></span>
            <strong className="case-tile-title">{item.title}</strong>
            <span className="case-tile-desc">{item.intake?.injury_description || item.notes || "No story added yet."}</span>
            <span className="case-tile-foot"><span>{diff === null ? "Amounts not added" : <>To investigate <b>{money(diff)}</b></>}</span><ArrowUpRight size={16} aria-hidden="true"/></span>
          </span>
        </a>;
      })}
      <a href="#new" className="case-tile case-tile--new" onMouseEnter={() => setHovered(cases.length)}>
        <AnimatePresence>{hovered === cases.length && <motion.span className="case-tile-hover" layoutId="case-hover" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}/>}</AnimatePresence>
        <span className="case-tile-inner"><span className="new-plus" aria-hidden="true"><Plus size={22}/></span><strong className="case-tile-title">Open a new case</strong><span className="case-tile-desc">Tell us what happened. Add documents as you go.</span></span>
      </a>
    </div>
  </>;
}

function Intake({hasCases, disabled, onCancel, onSave, live}: {hasCases: boolean; disabled: boolean; onCancel: () => void; onSave: (d: CaseInput) => Promise<void>; live: ReactNode}) {
  return <>
    <div className="page-head">
      <div>{hasCases && <button className="back-link" onClick={onCancel}><ArrowLeft size={16} aria-hidden="true"/>All cases</button>}<p className="eyebrow">Let’s start with your story</p><TextGenerate as="h1" text={hasCases ? "Open a new case." : "Let’s sort this out."}/><p className="lede">Tell us what happened. You can add documents and details as you go.</p></div>
      {live}
    </div>
    {!hasCases && <p className="demo-note">Prototype workspace. Use synthetic injury, insurance, and billing details only. Outreach requires an approved test operator, an approved recipient, and explicit authorization. No claims are submitted.</p>}
    <Reveal as="div" className="intake-card"><CaseForm disabled={disabled} onSave={onSave}/></Reveal>
  </>;
}

const SECTIONS = [
  {id: "section-overview", label: "Overview"},
  {id: "section-documents", label: "Documents"},
  {id: "section-review", label: "AI review"},
  {id: "section-outreach", label: "Outreach"},
  {id: "section-outcomes", label: "Outcomes"},
  {id: "section-authorization", label: "Authorization"},
];

function CaseView({item, userId, crewEnabled, busy, live, onSave, onAct}: {item: BillCase; userId: string; crewEnabled: boolean; busy: string | null; live: ReactNode; onSave: (d: CaseInput) => Promise<void>; onAct: (action: "analyze" | "delete") => Promise<boolean>}) {
  const [editing, setEditing] = useState(false);
  const diff = gap(item);
  const step = nextStep(item);
  const max = Math.max(item.bill_cents ?? 0, item.eob_cents ?? 0, 1);
  const facts = [
    ["Employer", item.intake?.employer_name], ["Insurer", item.intake?.insurer_name],
    ["Claim stage", item.intake?.claim_stage ? (item.intake.claim_stage === "unknown" ? "Not known yet" : item.intake.claim_stage.replaceAll("_", " ")) : undefined],
    ["Incident date", item.intake?.incident_date], ["Claim number", item.intake?.claim_number], ["Jurisdiction", item.intake?.jurisdiction],
  ].filter((f): f is [string, string] => !!f[1]);
  return <article className="case" data-case-id={item.id}>
    <div className="page-head">
      <div>
        <a className="back-link" href="#workspace"><ArrowLeft size={16} aria-hidden="true"/>All cases</a>
        <p className="eyebrow">{caseKind(item)} · Revision {item.revision}</p>
        <div className="case-title-row"><TextGenerate as="h1" text={item.title} wordDelay={0.06}/><span className="badge" data-status={item.status}>{item.status.replaceAll("_", " ")}</span></div>
      </div>
      <div className="page-head-side">{live}
        <div className="actions">
          <StatefulButton className="primary" disabled={busy !== null || item.status === "analyzing"} onAction={() => onAct("analyze")}>Review with AI<ArrowUpRight size={16} aria-hidden="true"/></StatefulButton>
          <button className="text-button danger-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void onAct("delete"); }}>Delete</button>
        </div>
      </div>
    </div>

    <Reveal as="div" className="next-step" delay={0.1}>
      <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
      <div><p className="eyebrow">Your next step</p><h2>{step.title}</h2><p>{step.body}</p></div>
      <a className="pill-link" href={step.href} onClick={e => { e.preventDefault(); if (step.href === "#section-overview") setEditing(true); document.getElementById(step.href.slice(1))?.scrollIntoView({behavior: "smooth"}); }}>{step.cta}<ArrowUpRight size={15} aria-hidden="true"/></a>
    </Reveal>

    <SectionNav sections={SECTIONS}/>

    <CaseSection id="section-overview" number="01" title="The story so far" aside={<button className="text-button" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? "Cancel editing" : "Update case details"}</button>}>
      <AnimatePresence initial={false}>
        {editing && <motion.div className="edit-panel" initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}>
          <p className="callout">Saving new details preserves earlier reviews and requires a new review before new outreach.</p>
          <CaseForm key={`${item.id}-${item.revision}`} initial={item} disabled={busy !== null} onSave={async d => { await onSave(d); setEditing(false); }}/>
        </motion.div>}
      </AnimatePresence>
      <div className="overview-grid">
        <div className="story">
          {item.intake?.injury_description ? <p className="story-text">{item.intake.injury_description}</p> : <p className="muted-empty">No description yet. Add what happened with “Update case details”.</p>}
          {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          {item.notes && <p className="notes">{item.notes}</p>}
        </div>
        <div className="money-card">
          <div className="money-row"><span>Bill</span><strong>{money(item.bill_cents)}</strong></div>
          <span className="bar" aria-hidden="true"><motion.span className="bar-fill bar-fill--bill" initial={{scaleX: 0}} animate={{scaleX: (item.bill_cents ?? 0) / max}} transition={{duration: 0.9, ease: [0.16, 1, 0.3, 1]}}/></span>
          <div className="money-row"><span>EOB responsibility</span><strong>{money(item.eob_cents)}</strong></div>
          <span className="bar" aria-hidden="true"><motion.span className="bar-fill" initial={{scaleX: 0}} animate={{scaleX: (item.eob_cents ?? 0) / max}} transition={{duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1]}}/></span>
          {diff !== null
            ? <p className="discrepancy">Potential discrepancy <b>{money(diff)}</b></p>
            : <p className="discrepancy discrepancy--unknown">Financial outcome unknown — bill or EOB amounts are not yet available.</p>}
          <small>This is an amount to investigate, not verified savings.</small>
        </div>
      </div>
      {item.analysis && <div className="analysis"><h4>Questions for the insurer</h4><p>{item.analysis}</p></div>}
    </CaseSection>

    <CaseSection id="section-documents" number="02" title="Documents & evidence" description="Add a synthetic insurance card, bill, EOB, or incident record. The intake agent reads it; you check the transcription before it becomes evidence.">
      <Documents key={`documents-${item.id}`} caseId={item.id} userId={userId} revision={item.revision} enabled={crewEnabled}/>
    </CaseSection>

    <CrewReview key={`${item.id}-${item.revision}`} revision={item.revision} id={item.id} userId={userId} enabled={crewEnabled}/>
  </article>;
}
