import type {ReactNode} from "react";

export function CaseSection({id, title, aside, children}: {id: string; title: string; aside?: ReactNode; children: ReactNode}) {
  return <section id={id} className="case-section" aria-label={title}>
    <header className="case-section-head"><h3>{title}</h3>{aside}</header>
    <div className="case-section-body">{children}</div>
  </section>;
}
