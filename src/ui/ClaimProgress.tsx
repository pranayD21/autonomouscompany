// Vertical claim stepper for the case page. Layout idea from the 21st.dev
// "Order Tracking" component by Javi (MIT); rebuilt in plain CSS, no code copied.
import {STEP_LABELS, STEP_ORDER, type Progress, type StepId, type StepState} from "../progress";
import {Check} from "../Icons";

const COPY: Record<StepId, Record<StepState, string>> = {
  details: {done: "Your story is saved", current: "Tell us what happened", todo: "What happened and when"},
  documents: {done: "We read your documents", current: "Add your claim papers", todo: "Cards, letters, bills, EOBs"},
  agent: {done: "Agent work finished", current: "", todo: "Research and insurer contact"},
  outcome: {done: "Decision recorded", current: "Waiting for a decision", todo: "The insurer’s decision"},
};

export function ClaimProgress({progress}: {progress: Progress | undefined}) {
  if (!progress?.loaded) return <section className="claim-progress" aria-label="Claim progress" aria-busy="true">
    <header><span className="eyebrow">Progress</span></header>
    <ol>{STEP_ORDER.map(id => <li key={id} data-state="todo"><span className="cp-marker"/><div><span className="ov-skeleton cp-skeleton"/></div></li>)}</ol>
  </section>;
  const done = STEP_ORDER.filter(id => progress.steps[id] === "done").length;
  return <section className="claim-progress" aria-label="Claim progress">
    <header><span className="eyebrow">Progress</span><span className="cp-count">{done} of {STEP_ORDER.length}</span></header>
    <ol>{STEP_ORDER.map(id => {
      const state = progress.steps[id];
      const line = state === "current" && id === progress.step ? progress.title : COPY[id][state] || progress.title;
      return <li key={id} data-state={state} data-owner={state === "current" ? progress.owner : undefined} aria-current={state === "current" ? "step" : undefined}>
        <span className="cp-marker" aria-hidden="true">{state === "done" ? <Check size={12}/> : <span/>}</span>
        <div><strong>{STEP_LABELS[id]}</strong><small>{line}</small></div>
        <span className="sr-only">{state === "done" ? "Done" : state === "current" ? "Current step" : "Not started"}</span>
      </li>;
    })}</ol>
  </section>;
}

/** Four-segment meter for the case header; opens the full stepper. */
export function ClaimProgressMeter({progress, expanded, onToggle}: {progress: Progress | undefined; expanded: boolean; onToggle: () => void}) {
  const done = progress?.loaded ? STEP_ORDER.filter(id => progress.steps[id] === "done").length : 0;
  return <button type="button" className="cp-meter" onClick={onToggle} aria-expanded={expanded} aria-controls="chat-panel" disabled={!progress?.loaded}>
    <span className="cp-meter-bars" aria-hidden="true">{STEP_ORDER.map(id => <i key={id} data-state={progress?.loaded ? progress.steps[id] : "todo"} data-owner={progress?.owner}/>)}</span>
    <span className="cp-meter-label">{progress?.loaded ? <>{STEP_LABELS[progress.step]} <b>{done}/{STEP_ORDER.length}</b></> : "Progress"}</span>
  </button>;
}
