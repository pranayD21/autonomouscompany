import type {ReactNode} from "react";
import {Reveal} from "./motion";

export function CaseSection({id, number, title, description, aside, children}: {id: string; number: string; title: string; description?: string; aside?: ReactNode; children: ReactNode}) {
  return <Reveal id={id} className="case-section" ariaLabel={title}>
    <header className="case-section-head">
      <div><span className="step-index">{number}</span><h3>{title}</h3>{description && <p>{description}</p>}</div>
      {aside}
    </header>
    <div className="case-section-body">{children}</div>
  </Reveal>;
}
