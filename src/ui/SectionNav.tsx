// Step tracker for a case: each step is done (check), current (filled pill, the
// step the next action belongs to) or still to come. Clicking scrolls to that
// step's section. The pill slides between steps (Aceternity "Animated Tabs").
import {useEffect, useRef} from "react";
import {motion} from "motion/react";
import {Check} from "../Icons";
import {STEP_LABELS, STEP_ORDER, type StepId, type StepState} from "../progress";

export const STEP_SECTION: Record<StepId, string> = {details: "section-overview", documents: "section-documents", agent: "section-authorization", outcome: "section-outcomes"};

export function StepTracker({steps}: {steps: Record<StepId, StepState>}) {
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => { current.current?.scrollIntoView({block: "nearest", inline: "center"}); }, [STEP_ORDER.map(s => steps[s]).join()]);
  return <nav className="step-tracker" aria-label="Case progress">
    <ol>{STEP_ORDER.map((id, i) => {
      const state = steps[id];
      return <li key={id}><a ref={state === "current" ? current : undefined} href={`#${STEP_SECTION[id]}`} className="step-item" data-state={state} aria-current={state === "current" ? "step" : undefined}
        onClick={e => { e.preventDefault(); document.getElementById(STEP_SECTION[id])?.scrollIntoView({behavior: "smooth", block: "start"}); }}>
        {state === "current" && <motion.span layoutId="step-pill" className="step-pill" transition={{type: "spring", bounce: 0.25, duration: 0.5}}/>}
        <span className="step-mark" aria-hidden="true">{state === "done" ? <Check size={12}/> : i + 1}</span>
        <span className="step-label">{STEP_LABELS[id]}</span>
        <span className="visually-hidden">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
      </a></li>;
    })}</ol>
  </nav>;
}
