import type {ReactNode} from "react";

export function WorkflowSection({number, title, children}: {number: string; title: string; children: ReactNode}) {
  return <details className="workflow-section"><summary><span><span className="step-index">{number}</span>{title}</span><span className="disclosure-icon" aria-hidden="true">+</span></summary><div className="workflow-content">{children}</div></details>;
}
