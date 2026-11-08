import {PhoneIntakes} from "./PhoneIntakes";
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
import {StepTracker} from "./ui/SectionNav";
import {CaseSection} from "./ui/CaseSection";
import {OWNER_LABEL, STEP_LABELS, STEP_ORDER, useProgressMap, type Owner, type Progress, type Target} from "./progress";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number | null) => cents === null ? "Not provided" : new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance";
const gap = (item: BillCase) => item.bill_cents !== null && item.eob_cents !== null ? Math.max(0, item.bill_cents - item.eob_cents) : null;
const STAGE: Record<string, string> = {not_started: "Claim not filed", submitted: "Claim submitted", pending: "Claim pending", denied: "Claim denied", accepted: "Claim accepted"};
const OWNER_EYEBROW: Record<Owner, string> = {you: "Your move", waiting: "Nothing needed from you", done: "Resolved"};

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
  if (status === "live") return <span className="live-dot" title="Live updates connected"><span className="visually-hidden">Live updates connected</span></span>;
  return <span className="status">Live updates: {status === "connecting" ? "reconnecting…" : status}</span>;
}

function OwnerChip({owner, loaded}: {owner: Owner; loaded: boolean}) {
  return <span className="owner-chip" data-owner={loaded ? owner : "loading"}>{loaded ? OWNER_LABEL[owner] : "Checking…"}</span>;
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
  const progress = useProgressMap(cases, userId, crewEnabled);
  const selected = route.view === "case" ? cases.find(c => c.id === route.id) : undefined;
  const showIntake = data !== undefined && (route.view === "new" || cases.length === 0);
  const live = <LiveStatus status={status}/>;

  let view: ReactNode;
  let viewKey: string;
  if (data === undefined) { view = <p role="status" className="loading-line">Connecting to your cases…</p>; viewKey = "loading"; }
  else if (showIntake) { view = <Intake hasCases={cases.length > 0} disabled={busy !== null} onCancel={() => go("#workspace")} onSave={d => saveDetails(d)} live={live}/>; viewKey = "new"; }
  else if (route.view === "case" && !selected) { view = <div className="empty"><p>This case isn’t available. It may have been deleted.</p><a className="text-link" href="#workspace">Back to all cases</a></div>; viewKey = "missing"; }
  else if (selected) { view = <CaseView key={selected.id} item={selected} progress={progress.get(selected.id)!} userId={userId} crewEnabled={crewEnabled} busy={busy} live={live} onSave={d => saveDetails(d, selected)} onAct={action => act(selected.id, action)}/>; viewKey = `case-${selected.id}`; }
  else { view = <Overview cases={cases} progress={progress} userName={userName} live={live}/>; viewKey = "overview"; }

  return <div className="shell">
    <Sidebar footer={<div className="sidebar-user"><span className="avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span><SidebarText className="sidebar-user-name">{userName}</SidebarText><button className="icon-button sign-out" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div>}>
      <SidebarLink href="#workspace" icon={<Home size={20}/>} label="Overview" active={route.view === "overview" && cases.length > 0}/>
      <SidebarLink href="#new" icon={<Plus size={20}/>} label="New case" active={showIntake}/>
      <SidebarSection label={`Your cases · ${cases.length}`}/>
      {cases.map(item => { const p = progress.get(item.id)!; return <SidebarLink key={item.id} href={`#case/${item.id}`} active={selected?.id === item.id}
        icon={<span className="case-dot" data-owner={p.loaded ? p.owner : "loading"}>{item.title.trim().slice(0, 1).toUpperCase() || "•"}</span>}
        label={item.title} meta={p.loaded ? OWNER_LABEL[p.owner] : ""}/>; })}
    </Sidebar>
    <main id="workspace-content" className="surface">
      <PhoneIntakes userId={userId}/>
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

const GROUPS: {owner: Owner; title: string}[] = [{owner: "you", title: "Needs you"}, {owner: "waiting", title: "Waiting on others"}, {owner: "done", title: "Resolved"}];
const RANK: Record<string, number> = {details: 0, documents: 1, agent: 2, outcome: 3};

function Overview({cases, progress, userName, live}: {cases: readonly BillCase[]; progress: Map<string, Progress>; userName: string; live: ReactNode}) {
  const loaded = cases.every(c => progress.get(c.id)?.loaded);
  const needsYou = cases.filter(c => progress.get(c.id)?.loaded && progress.get(c.id)?.owner === "you").sort((a, b) => RANK[progress.get(a.id)!.step] - RANK[progress.get(b.id)!.step]);
  const top = needsYou[0];
  const topProgress = top && progress.get(top.id);
  const total = cases.filter(c => progress.get(c.id)?.owner !== "done").reduce((sum, c) => sum + (gap(c) ?? 0), 0);
  const headline = !loaded ? "Your cases" : needsYou.length === 0 ? "You’re all caught up." : `${needsYou.length} ${needsYou.length === 1 ? "case needs" : "cases need"} you`;
  return <>
    <div className="page-head">
      <div><p className="eyebrow"><Greeting name={userName}/></p><h1 className="overview-title">{headline}</h1>
        <p className="overview-meta">{cases.length} open · {total > 0 ? <>{money(total)} to investigate <span className="unverified">(unverified)</span></> : "no amounts to investigate yet"}</p></div>
      {live}
    </div>

    {top && topProgress && <a className="next-step next-step--link" href={`#case/${top.id}`}>
      <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
      <div><p className="eyebrow">Your move · {top.title}</p><h2>{topProgress.title}</h2></div>
      <span className="pill-link">Open case <ArrowUpRight size={15} aria-hidden="true"/></span>
    </a>}

    {GROUPS.map(group => {
      const items = group.owner === "you" ? needsYou : cases.filter(c => progress.get(c.id)?.loaded && progress.get(c.id)?.owner === group.owner);
      const pending = group.owner === "you" && !loaded ? cases.filter(c => !progress.get(c.id)?.loaded) : [];
      const list = [...items, ...pending];
      if (!list.length && group.owner !== "you") return null;
      return <section key={group.owner} className="case-group" aria-label={group.title}>
        <h2 className="group-title">{loaded ? group.title : "Your cases"}<span className="count">{list.length}</span></h2>
        <div className="case-grid">
          {list.map(item => <CaseTile key={item.id} item={item} progress={progress.get(item.id)!}/>)}
          {group.owner === "you" && <a href="#new" className="case-tile case-tile--new"><span className="case-tile-inner"><span className="new-plus" aria-hidden="true"><Plus size={20}/></span><strong className="case-tile-title">Open a new case</strong></span></a>}
        </div>
      </section>;
    })}
  </>;
}

function CaseTile({item, progress}: {item: BillCase; progress: Progress}) {
  const diff = gap(item);
  const o = progress.outcome;
  return <a href={`#case/${item.id}`} className="case-tile" data-owner={progress.loaded ? progress.owner : "loading"}>
    <span className="case-tile-inner">
      <span className="case-tile-top"><span className="case-tile-kind">{caseKind(item)}</span><OwnerChip owner={progress.owner} loaded={progress.loaded}/></span>
      <strong className="case-tile-title">{item.title}</strong>
      <span className="case-tile-next">{progress.loaded ? <>{progress.owner === "you" && <span aria-hidden="true">→ </span>}{progress.title}</> : "Checking this case…"}</span>
      <span className="case-tile-foot"><span>{o && o.final_responsibility_cents !== null ? <>Now owe <b>{money(o.final_responsibility_cents)}</b></> : diff === null ? "Amounts missing" : <><b>{money(diff)}</b> to investigate</>}</span><ArrowUpRight size={16} aria-hidden="true"/></span>
    </span>
  </a>;
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

function CaseView({item, progress, userId, crewEnabled, busy, live, onSave, onAct}: {item: BillCase; progress: Progress; userId: string; crewEnabled: boolean; busy: string | null; live: ReactNode; onSave: (d: CaseInput) => Promise<void>; onAct: (action: "analyze" | "delete") => Promise<boolean>}) {
  const [editing, setEditing] = useState(false);
  const diff = gap(item);
  const max = Math.max(item.bill_cents ?? 0, item.eob_cents ?? 0, 1);
  const bothKnown = item.bill_cents !== null && item.eob_cents !== null;
  const o = progress.outcome;
  const stepNumber = STEP_ORDER.indexOf(progress.step) + 1;
  const stage = item.intake?.claim_stage ? STAGE[item.intake.claim_stage] : undefined;
  const facts = [
    ["Insurer", item.intake?.insurer_name], ["Employer", item.intake?.employer_name], ["Claim number", item.intake?.claim_number],
    ["Incident date", item.intake?.incident_date], ["Jurisdiction", item.intake?.jurisdiction],
  ].filter((f): f is [string, string] => !!f[1]);
  const openEditor = () => { setEditing(true); document.getElementById("section-overview")?.scrollIntoView({behavior: "smooth"}); };
  const goTo = (target: Target) => { if (target === "edit") openEditor(); else document.getElementById(target.slice(1))?.scrollIntoView({behavior: "smooth", block: "start"}); };

  return <article className="case" data-case-id={item.id}>
    <div className="page-head">
      <div>
        <a className="back-link" href="#workspace"><ArrowLeft size={16} aria-hidden="true"/>All cases</a>
        <p className="case-status-line">
          <OwnerChip owner={progress.owner} loaded={progress.loaded}/>
          {progress.loaded && progress.owner !== "done" && <span>Step {stepNumber} of {STEP_ORDER.length} · {STEP_LABELS[progress.step]}</span>}
          <span className="sep">{caseKind(item)}{item.intake?.claim_number ? ` · ${item.intake.claim_number}` : ""}</span>
          {stage && !o && <span className="stage-chip" data-stage={item.intake?.claim_stage}>{stage}</span>}
          {live}
        </p>
        <h1 className="case-title">{item.title}</h1>
      </div>
    </div>

    <div className="case-hero">
      <div className="next-step" data-owner={progress.loaded ? progress.owner : "loading"}>
        <span className="next-step-icon" aria-hidden="true"><Sparkle size={18}/></span>
        <div>
          <p className="eyebrow">{progress.loaded ? OWNER_EYEBROW[progress.owner] : "Checking your case…"}</p>
          <h2>{progress.loaded ? progress.title : " "}</h2>
          {progress.loaded && progress.note && <p>{progress.note}</p>}
        </div>
        {progress.loaded && progress.cta && <a className="pill-link" href={progress.cta.target === "edit" ? "#section-overview" : progress.cta.target} onClick={e => { e.preventDefault(); goTo(progress.cta!.target); }}>{progress.cta.label}<ArrowUpRight size={15} aria-hidden="true"/></a>}
      </div>
      {o && o.final_responsibility_cents !== null
        ? <div className="money-card">
            <p className="discrepancy">Reported you now owe <b>{money(o.final_responsibility_cents)}</b></p>
            <div className="money-row"><span>Originally</span><span>{money(o.original_responsibility_cents)}</span></div>
            <div className="money-row"><span>Reported reduction</span><span>{money(o.reduction_cents)}</span></div>
            <small>Agent-reported — not verified.</small>
          </div>
        : bothKnown
        ? <div className="money-card">
            <p className="discrepancy">To investigate <b>{money(diff)}</b></p>
            <div className="money-row"><span>Bill</span><span>{money(item.bill_cents)}</span></div>
            <span className="bar" aria-hidden="true"><motion.span className="bar-fill bar-fill--bill" initial={{scaleX: 0}} animate={{scaleX: (item.bill_cents ?? 0) / max}} transition={{duration: 0.8, ease: [0.16, 1, 0.3, 1]}}/></span>
            <div className="money-row"><span>EOB responsibility</span><span>{money(item.eob_cents)}</span></div>
            <span className="bar" aria-hidden="true"><motion.span className="bar-fill" initial={{scaleX: 0}} animate={{scaleX: (item.eob_cents ?? 0) / max}} transition={{duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}/></span>
            <small>Not verified savings.</small>
          </div>
        : item.case_type === "health_insurance" || item.bill_cents !== null || item.eob_cents !== null
        ? <div className="money-card money-card--empty">
            <p>{item.bill_cents === null && item.eob_cents === null ? "Amounts missing." : item.bill_cents === null ? `EOB responsibility ${money(item.eob_cents)} · bill missing` : `Bill ${money(item.bill_cents)} · EOB missing`}</p>
            <button className="text-button" onClick={openEditor}>Add bill and EOB amounts</button>
          </div>
        : null}
    </div>

    <StepTracker steps={progress.steps}/>

    <CaseSection id="section-overview" title="Details" status={progress.steps.details} aside={<button className="text-button" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? "Cancel editing" : "Update case details"}</button>}>
      <AnimatePresence initial={false}>
        {editing && <motion.div className="edit-panel" initial={{height: 0, opacity: 0}} animate={{height: "auto", opacity: 1}} exit={{height: 0, opacity: 0}} transition={{duration: 0.3, ease: [0.16, 1, 0.3, 1]}}>
          <p className="caveat">Updates are saved as new case evidence. An active agent can use them on its next turn.</p>
          <CaseForm key={`${item.id}-${item.revision}`} initial={item} disabled={busy !== null} onSave={async d => { await onSave(d); setEditing(false); }}/>
        </motion.div>}
      </AnimatePresence>
      {item.intake?.injury_description ? <p className="story-text">{item.intake.injury_description}</p> : <p className="quiet-line">No description yet.</p>}
      {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {item.notes && <p className="notes">{item.notes}</p>}
    </CaseSection>

    <CaseSection id="section-documents" title="Documents" status={progress.steps.documents}>
      <Documents key={`documents-${item.id}`} caseId={item.id} userId={userId} revision={item.revision}/>
    </CaseSection>

    <CrewReview key={`${item.id}-${item.revision}`} revision={item.revision} id={item.id} userId={userId} enabled={crewEnabled} quickAnalysis={item.analysis} steps={progress.steps}/>

    <div className="case-end">
      <button className="text-button quiet-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void onAct("delete"); }}>Delete</button>
    </div>
  </article>;
}
