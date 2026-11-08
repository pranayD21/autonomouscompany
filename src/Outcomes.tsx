import {useEffect, useState} from "react";
import {motion} from "motion/react";
import {api} from "./services";
import {NumberTicker} from "./ui/motion";
import type {readCaseOutcomes} from "../backend/case-outcome";

type OutcomesData = Awaited<ReturnType<typeof readCaseOutcomes>>;
const money = (value: number | null) => value === null ? "Not established" : new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(value / 100);

/** The latest agent-reported outcome. Renders nothing until one exists. */
export function Outcomes({caseId, userId, revision}: {caseId: string; userId: string; revision: number}) {
  const [data, setData] = useState<OutcomesData>([]), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData([]); setError("");
    const read = () => api<OutcomesData>(`/cases/${caseId}/outcomes`, {}, userId)
      .then(rows => { if (live) { setData(rows); setError(""); } })
      .catch(() => { if (live) setError("Could not refresh the outcome. It may be out of date."); });
    void read();
    const timer = setInterval(() => void read(), 15000);
    return () => { live = false; clearInterval(timer); };
  }, [caseId, userId, revision]);

  const latest = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!latest) return null;
  const r = latest.report;
  const scale = Math.max(r.original_responsibility_cents ?? 0, r.final_responsibility_cents ?? 0, 1);
  return <section id="section-outcome" className="case-section outcome" aria-label="Case outcomes">
    <header className="case-section-head"><h3>Outcome</h3><small>{new Date(latest.created_at).toLocaleDateString()}</small></header>
    {!latest.evidence_current && <p role="alert">The evidence behind this outcome is no longer current. Don’t rely on these amounts until it is reviewed.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="savings">
      <div className="savings-main">
        <span className="savings-label">You save</span>
        <strong>{r.reduction_cents === null ? "—" : <NumberTicker value={r.reduction_cents} format={n => money(Math.round(n))}/>}</strong>
        <span className="decision-pill" data-decision={r.claim_decision}>Claim {r.claim_decision.replaceAll("_", " ")}</span>
      </div>
      <div className="savings-bars">
        {([["You owed", r.original_responsibility_cents, "before"], ["You owe now", r.final_responsibility_cents, "now"]] as const).map(([label, cents, kind], i) =>
          <div key={kind} className="savings-row">
            <div className="savings-row-head"><span>{label}</span><b>{money(cents)}</b></div>
            <span className="bar" aria-hidden="true"><motion.span className="bar-fill" data-kind={kind} initial={{scaleX: 0}} animate={{scaleX: cents === null ? 0 : cents / scale}} transition={{duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1]}}/></span>
          </div>)}
        <div className="savings-row-head savings-refund"><span>Refund received</span><b>{money(r.refund_received_cents)}</b></div>
      </div>
    </div>
    <p className="outcome-summary">{r.summary}</p>
    <details><summary>How this was worked out</summary>
      <p>{r.calculation_explanation}</p>
      <h4>Supporting quotes</h4>
      {r.evidence.map((source, i) => <blockquote key={i}>{source.quote}<small>{source.source_ref.startsWith("document:") ? "From a document" : "From a reply"}</small></blockquote>)}
    </details>
    <p className="caveat">Reported by Assurance from your documents and replies. Not a verified payout.</p>
  </section>;
}
