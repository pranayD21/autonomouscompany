import {PhoneEntry} from "./PhoneEntry";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RealtimeProvider } from "@neon/realtime-react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import type { BillCase } from "../backend/schema";
import { auth, realtime, sealCases } from "./services";
import "./style.css";
import {Landing} from "./Landing";
import {Workspace} from "./Workspace";
import {Asterisk} from "./Icons";
import {MotionConfig} from "motion/react";

const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

function Dashboard({ userId, userName, onSignOut }: { userId: string; userName: string; onSignOut: () => void }) {
  const [sealed, setSealed] = useState<SealedLiveQuery<BillCase>>();
  const [error, setError] = useState("");
  useEffect(() => { let active = true; sealCases(userId).then((result) => { if (active) setSealed(result); }).catch((err) => { if (active) setError(message(err)); }); return () => { active = false; }; }, [userId]);
  if (error) return <p role="alert" className="error">{error}</p>;
  return sealed ? <Workspace sealed={sealed} userId={userId} userName={userName} onSignOut={onSignOut}/> : <p className="loading-line">Opening your workspace…</p>;
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
  if (!isPending && (locationHash === "#home" || (!session?.user && locationHash !== "#workspace" && !locationHash.startsWith("#case/") && !error))) return <Landing/>;
  if (!isPending && !error && session?.user) return <>{signOutError && <p role="alert" className="error floating-error">{signOutError}</p>}<Dashboard key={session.user.id} userId={session.user.id} userName={session.user.name || session.user.phoneNumber || session.user.email || "Your account"} onSignOut={() => void signOut()}/></>;
  return <><a className="skip-link" href="#workspace-content">Skip to content</a><header className="app-header"><a href="#home" className="brand" aria-label="Assurance home"><Asterisk strokeWidth={2.5} aria-hidden="true"/>assurance<span className="brand-period">.</span></a></header>
    <main id="workspace-content" className="app-main">{isPending ? <p role="status">Loading your session…</p> : error ? <p role="alert" className="error">Authentication is unavailable. Please reload and try again.</p> : <PhoneEntry/>}</main>
    <footer className="app-footer"><span>assurance<span className="brand-period">.</span></span><small>Your case, handled.</small></footer></>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><RealtimeProvider client={realtime}><MotionConfig reducedMotion="user"><App/></MotionConfig></RealtimeProvider></StrictMode>);
