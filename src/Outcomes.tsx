import {useEffect, useState} from "react";
import {api} from "./services";
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
  return <section className="case-section outcome" aria-label="Case outcomes">
    <header className="case-section-head"><h3>Outcome</h3><small>{new Date(latest.created_at).toLocaleDateString()}</small></header>
    {!latest.evidence_current && <p role="alert">The evidence behind this outcome is no longer current. Don’t rely on these amounts until it is reviewed.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="outcome-summary">{r.summary}</p>
    <dl className="outcome-figures">
      <div><dt>Claim decision</dt><dd className="decision">{r.claim_decision.replaceAll("_", " ")}</dd></div>
      <div><dt>You owed before</dt><dd>{money(r.original_responsibility_cents)}</dd></div>
      <div><dt>You owe now</dt><dd>{money(r.final_responsibility_cents)}</dd></div>
      <div><dt>Reduction</dt><dd>{money(r.reduction_cents)}</dd></div>
      <div><dt>Refund received</dt><dd>{money(r.refund_received_cents)}</dd></div>
    </dl>
    <details><summary>How this was worked out</summary>
      <p>{r.calculation_explanation}</p>
      <h4>Supporting quotes</h4>
      {r.evidence.map((source, i) => <blockquote key={i}>{source.quote}<small>{source.source_ref.startsWith("document:") ? "From a document" : "From a reply"}</small></blockquote>)}
    </details>
    <p className="caveat">Reported by Assurance from your documents and replies. Not a verified payout.</p>
  </section>;
}
