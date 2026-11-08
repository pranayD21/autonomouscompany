import { StrictMode, useCallback, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import type { BillCase } from "../backend/schema";
import { api, auth, realtime, sealCases } from "./services";
import "./style.css";
import {CaseForm} from "./CaseForm";
import type {CaseInput} from "../backend/claim-input";
import {Documents} from "./Documents";
import {CrewReview} from "./CrewReview";
import {Landing} from "./Landing";
import {Asterisk, ArrowUpRight} from "./Icons";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number|null) => cents===null?"Not provided": new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function SignIn() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get("email")), password: String(form.get("password")) };
    try {
      const result = signup ? await auth.signUp.email({ ...credentials, name: String(form.get("name")) }) : await auth.signIn.email(credentials);
      if (result.error) throw new Error(result.error.message ?? "Unable to sign in.");
      window.location.assign("/#workspace");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section className="auth-card"><p className="eyebrow">YOUR CLAIM WORKSPACE</p><h1>A clearer path through your insurance claim.</h1><p>Keep your case, questions, and next steps together.</p>
    <form onSubmit={submit}>
      {signup && <label>Name<input name="name" required autoComplete="name" maxLength={100}/></label>}
      <label>Email<input name="email" type="email" required autoComplete="email"/></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"}/></label>
      <button disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="text-button" onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
  </section>;
}

function CaseList({ sealed, userId }: { sealed: SealedLiveQuery<BillCase>; userId: string }) {
  const refreshQuery = useCallback(() => sealCases(userId), [userId]);
  const { data, status, error, utils } = useLiveQuery(sealed, { refreshQuery });
  const [notice, setNotice] = useState("");
  const [crewEnabled,setCrewEnabled]=useState(false);
  useEffect(()=>{api<{naive:{configured:boolean;enabledForUser:boolean}}>("/stack/status",{},userId).then(s=>setCrewEnabled(s.naive.configured&&s.naive.enabledForUser)).catch(()=>{});},[userId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing,setEditing]=useState<BillCase|null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selectedCase = data?.find(item => item.id === selectedId) ?? data?.[0];
  async function saveDetails(details:CaseInput,existing?:BillCase) {
    setBusy(existing?.id??"create");setNotice("");
    try {
      const result=await api<{id:string;txid:string}>(existing?`/cases/${existing.id}`:"/cases",{method:existing?"PATCH":"POST",body:JSON.stringify({...details,...existing?{revision:existing.revision}:{}})},userId);
      await utils.awaitTxId(result.txid,15000);setEditing(null);
      if (!existing) { setCreating(false); setSelectedId(result.id); }
    }catch(err){setNotice(message(err));throw err;}finally{setBusy(null);}
  }
  async function act(id: string, action: "analyze" | "delete") {
    setBusy(id); setNotice("");
    try {
      const result = await api<{ txid: string }>(`/cases/${id}${action === "analyze" ? "/analyze" : ""}`, { method: action === "analyze" ? "POST" : "DELETE" }, userId);
      await utils.awaitTxId(result.txid, 15_000);
    } catch (err) { setNotice(message(err)); } finally { setBusy(null); }
  }
  return <>
    <div className="section-heading"><div><p className="eyebrow">YOUR CLAIM WORKSPACE</p><h1>Your claim.<br/><span>Under control.</span></h1><p>One place for the paperwork. One clear next step.</p></div><span className="status" data-live={status === "live"}>{status === "live" ? "Live updates connected" : `Live updates: ${status}`}</span></div>
    <p className="demo-note">Prototype workspace. Use synthetic injury, insurance, and billing details only. Outreach requires an approved test operator, an approved recipient, and explicit authorization. No claims are submitted.</p>
    <div className="workspace"><aside className="case-sidebar" aria-label="Case navigation">
      <div className="sidebar-heading"><h2>Your cases <span className="count">{data?.length ?? 0}</span></h2></div>
      <button className="new-case-button" onClick={() => { setCreating(true); setEditing(null); }}>Open a case <span aria-hidden="true">+</span></button>
      <div className="case-list">{data?.map(item => <button key={item.id} className="case-select" aria-current={!creating && selectedCase?.id === item.id ? "true" : undefined} onClick={() => { setSelectedId(item.id); setCreating(false); setEditing(null); }}><span className="case-select-type">{item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance"}</span><strong>{item.title}</strong><span className="case-select-status">{item.status.replaceAll("_", " ")}</span></button>)}</div>
      <p className="sidebar-note">Your call.<br/>Every step of the way.</p>
      </aside>
      <section className="case-column" aria-label="Selected case" aria-live="polite">
        {error && <p role="alert" className="error">Live updates stopped: {error.message}. Reload to reconnect.</p>}
        {notice && <p role="alert" className="error">{notice}</p>}
        {data === undefined ? <p role="status">Connecting to your cases…</p> : creating || data.length === 0 ? <section className="panel intake-panel"><p className="eyebrow">LET’S START WITH YOUR STORY</p><div className="case-heading"><h2>Open a case</h2>{data.length > 0 && <button className="text-button" onClick={() => setCreating(false)}>Cancel</button>}</div><p>Tell us what happened. You can add documents and details as you go.</p><CaseForm disabled={busy!==null} onSave={details=>saveDetails(details)}/></section> : [selectedCase!].map((item) => <article className="panel case" key={item.id} data-case-id={item.id}>
          <p className="eyebrow">{item.case_type==="workplace_injury"?"Workplace injury":"Health-insurance dispute"} · Revision {item.revision}</p>
          <div className="case-heading"><h2>{item.title}</h2><span className="badge">{item.status.replaceAll("_", " ")}</span></div>
          <p className="case-overview-label">THE STORY SO FAR</p>
          {item.intake?.injury_description&&<p>{item.intake.injury_description}</p>}
          {item.intake?.employer_name&&<p>Employer: {item.intake.employer_name}</p>}
          {item.intake?.insurer_name&&<p>Insurer: {item.intake.insurer_name}</p>}
          {item.intake?.claim_stage&&<p>Reported claim stage: {item.intake.claim_stage==="unknown"?"Not known yet":item.intake.claim_stage}</p>}
          <button className="text-button" onClick={()=>setEditing(item)}>Update case details</button>
          {editing?.id===item.id&&<section><p>Saving new details preserves earlier reviews and requires a new review before new outreach.</p><CaseForm key={`${editing.id}-${editing.revision}`} initial={editing} disabled={busy!==null} onSave={details=>saveDetails(details,editing)}/><button className="text-button" onClick={()=>setEditing(null)}>Cancel editing</button></section>}
          <div className="amounts"><p>Bill<strong>{money(item.bill_cents)}</strong></p><p>EOB responsibility<strong>{money(item.eob_cents)}</strong></p></div>
          {item.bill_cents!==null&&item.eob_cents!==null?<p className="discrepancy">Potential discrepancy: <b>{money(Math.max(0,item.bill_cents-item.eob_cents))}</b></p>:<p>Financial outcome unknown — bill or EOB amounts are not yet available.</p>}
          <small>This is an amount to investigate, not verified savings.</small>
          {item.notes && <p>{item.notes}</p>}
          {item.analysis && <div className="analysis"><h4>Questions for the insurer</h4><p>{item.analysis}</p></div>}
          <details className="workflow-section"><summary><span><span className="step-index">01</span>Documents & evidence</span><span className="disclosure-icon" aria-hidden="true">+</span></summary><div className="workflow-content"><Documents key={`documents-${item.id}`} caseId={item.id} userId={userId} revision={item.revision} enabled={crewEnabled}/></div></details>
          <CrewReview key={`${item.id}-${item.revision}`} revision={item.revision} id={item.id} userId={userId} enabled={crewEnabled}/><div className="actions case-actions"><button disabled={busy !== null || item.status === "analyzing"} onClick={() => act(item.id, "analyze")}>{busy === item.id ? "Working…" : "Review with AI"}<ArrowUpRight size={16} aria-hidden="true"/></button><button className="text-button danger-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void act(item.id, "delete"); }}>Delete case</button></div>
        </article>)}
      </section></div>
  </>;
}

function Dashboard({ userId }: { userId: string }) {
  const [sealed, setSealed] = useState<SealedLiveQuery<BillCase>>();
  const [error, setError] = useState("");
  useEffect(() => { let active = true; sealCases(userId).then((result) => { if (active) setSealed(result); }).catch((err) => { if (active) setError(message(err)); }); return () => { active = false; }; }, [userId]);
  if (error) return <p role="alert" className="error">{error}</p>;
  return sealed ? <CaseList sealed={sealed} userId={userId}/> : <p>Opening your workspace…</p>;
}

function App() {
  const { data: session, isPending, error } = auth.useSession();
  const [signOutError, setSignOutError] = useState("");
  const [locationHash, setLocationHash] = useState(window.location.hash);
  useEffect(() => {
    const syncHash = () => {
      setLocationHash(window.location.hash);
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) {
        let parent = target.parentElement;
        while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
        target.scrollIntoView({block: "start"});
      }
    };
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  async function signOut() {
    try { const result = await auth.signOut(); if (result.error) throw new Error(result.error.message); realtime.close(); window.location.assign("/"); }
    catch (err) { setSignOutError(message(err)); }
  }
  if (!isPending && (locationHash === "#home" || (!session?.user && locationHash !== "#workspace" && !error))) return <Landing/>;
  return <><a className="skip-link" href="#workspace-content">Skip to content</a><header className="app-header"><a href="#home" className="brand" aria-label="Assurance home"><Asterisk strokeWidth={2.5} aria-hidden="true"/>assurance<span className="brand-period">.</span></a>{session?.user && <div className="account"><span>{session.user.name}</span><button className="text-button" onClick={signOut}>Sign out</button></div>}</header>
    <main id="workspace-content" className="app-main">{signOutError && <p role="alert" className="error">{signOutError}</p>}{isPending ? <p role="status">Loading your session…</p> : error ? <p role="alert" className="error">Authentication is unavailable. Please reload and try again.</p> : session?.user ? <Dashboard key={session.user.id} userId={session.user.id}/> : <SignIn/>}</main>
    <footer className="app-footer"><span>assurance<span className="brand-period">.</span></span><span>On your side. Not in your way.</span><small>Prototype · Synthetic data only</small></footer></>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><RealtimeProvider client={realtime}><App/></RealtimeProvider></StrictMode>);
