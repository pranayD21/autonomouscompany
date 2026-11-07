import { StrictMode, useCallback, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import type { BillCase } from "../backend/schema";
import { api, auth, realtime, sealCases } from "./services";
import "./style.css";
import {CrewReview} from "./CrewReview";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

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
      window.location.assign("/");
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <section className="auth-card"><p className="eyebrow">YOUR BILLING WORKSPACE</p><h1>A clearer path through your bills.</h1><p>Keep your case, questions, and next steps together.</p>
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
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy("create"); setNotice("");
    try {
      const result = await api<{ txid: string }>("/cases", { method: "POST", body: JSON.stringify({
        title: values.get("title"), bill_cents: Math.round(Number(values.get("bill")) * 100),
        eob_cents: Math.round(Number(values.get("eob")) * 100), notes: values.get("notes"),
      }) }, userId);
      await utils.awaitTxId(result.txid, 15_000); form.reset();
    } catch (err) { setNotice(message(err)); } finally { setBusy(null); }
  }
  async function act(id: string, action: "analyze" | "delete") {
    setBusy(id); setNotice("");
    try {
      const result = await api<{ txid: string }>(`/cases/${id}${action === "analyze" ? "/analyze" : ""}`, { method: action === "analyze" ? "POST" : "DELETE" }, userId);
      await utils.awaitTxId(result.txid, 15_000);
    } catch (err) { setNotice(message(err)); } finally { setBusy(null); }
  }
  return <>
    <div className="section-heading"><div><p className="eyebrow">CASE WORKSPACE</p><h1>Your next step, in one place.</h1></div><span className="status">{status === "live" ? "Live updates connected" : `Live updates: ${status}`}</span></div>
    <p className="demo-note">Prototype workspace. Use synthetic billing details only. Outreach requires an approved test operator, an approved recipient, and explicit authorization. No claims are submitted.</p>
    <div className="workspace"><section className="panel"><h2>Open a case</h2><p>Compare the bill with the patient responsibility on the EOB.</p>
      <form onSubmit={create}>
        <label>Case title<input name="title" required maxLength={120} placeholder="Example hospital visit"/></label>
        <div className="amounts"><label>Bill amount ($)<input name="bill" type="number" required min="0" max="1000000" step="0.01"/></label><label>EOB responsibility ($)<input name="eob" type="number" required min="0" max="1000000" step="0.01"/></label></div>
        <label>Case notes<textarea name="notes" maxLength={8000} rows={4} placeholder="What needs clarification?"/></label>
        <button disabled={busy !== null || data === undefined}>Save case</button>
      </form></section>
      <section className="case-column" aria-live="polite"><h2>Your cases <span className="count">{data?.length ?? 0}</span></h2>
        {error && <p role="alert" className="error">Live updates stopped: {error.message}. Reload to reconnect.</p>}
        {notice && <p role="alert" className="error">{notice}</p>}
        {data === undefined ? <p>Connecting to your cases…</p> : data.length === 0 ? <div className="empty">Your first case starts here. Add the two amounts to keep track of what needs checking.</div> : data.map((item) => <article className="panel case" key={item.id} data-case-id={item.id}>
          <div className="case-heading"><h3>{item.title}</h3><span className="badge">{item.status}</span></div>
          <div className="amounts"><p>Bill<strong>{money(item.bill_cents)}</strong></p><p>EOB responsibility<strong>{money(item.eob_cents)}</strong></p></div>
          <p className="discrepancy">Potential discrepancy: <b>{money(Math.max(0, item.bill_cents - item.eob_cents))}</b></p>
          <small>This is an amount to investigate, not verified savings.</small>
          {item.notes && <p>{item.notes}</p>}
          {item.analysis && <div className="analysis"><h4>Questions for billing</h4><p>{item.analysis}</p></div>}
          <CrewReview id={item.id} userId={userId} enabled={crewEnabled}/><div className="actions"><button disabled={busy !== null || item.status === "analyzing"} onClick={() => act(item.id, "analyze")}>{busy === item.id ? "Working…" : "Review with AI"}</button><button className="text-button" disabled={busy !== null} onClick={() => { if (window.confirm("Delete this case?")) void act(item.id, "delete"); }}>Delete</button></div>
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
  async function signOut() {
    try { const result = await auth.signOut(); if (result.error) throw new Error(result.error.message); realtime.close(); window.location.assign("/"); }
    catch (err) { setSignOutError(message(err)); }
  }
  return <><header><a href="/" className="brand"><span className="brand-mark">b</span>Bill Advocate</a>{session?.user && <div className="account"><span>{session.user.name}</span><button className="text-button" onClick={signOut}>Sign out</button></div>}</header>
    <main>{signOutError && <p role="alert" className="error">{signOutError}</p>}{isPending ? <p>Loading your session…</p> : error ? <p role="alert" className="error">Authentication is unavailable. Please reload and try again.</p> : session?.user ? <Dashboard key={session.user.id} userId={session.user.id}/> : <SignIn/>}</main>
    <footer>Bill Advocate · Medical billing case prototype</footer></>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><RealtimeProvider client={realtime}><App/></RealtimeProvider></StrictMode>);
