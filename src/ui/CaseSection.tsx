import type {ReactNode} from "react";
import type {StepState} from "../progress";

const STATUS_TEXT: Record<StepState, string> = {done: "Done", current: "Next step", todo: ""};

export function CaseSection({id, title, status, aside, children}: {id: string; title: string; status?: StepState; aside?: ReactNode; children: ReactNode}) {
  return <section id={id} className="case-section" data-step={status} aria-label={title}>
    <header className="case-section-head"><h3>{title}{status && STATUS_TEXT[status] && <span className="section-status" data-step={status}>{STATUS_TEXT[status]}</span>}</h3>{aside}</header>
    <div className="case-section-body">{children}</div>
  </section>;
}
