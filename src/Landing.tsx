import { ArrowDown, ArrowUpRight, Asterisk, ShieldCheck } from "./Icons";
import { MinimalHero } from "./components/minimal-hero";
import { StrikethroughReplace } from "./components/strikethrough-replace";

const workspaceUrl = "#workspace";

const steps = [
  { number: "01", title: "Tell us what happened.", description: "Start with your story. Add the details you know, when you know them." },
  { number: "02", title: "Make sense of the paperwork.", description: "Keep your bills, benefits statements, and evidence together. Review what they actually say." },
  { number: "03", title: "Know your next move.", description: "Review proposed next steps. You decide what gets sent, and when." },
];

export function Landing() {
  return (
    <main className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Assurance home"><Asterisk strokeWidth={2.5} aria-hidden="true" />assurance<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation"><a className="nav-explain" href="#how-it-works">How it works</a><a className="nav-workspace" href={workspaceUrl}>Open workspace <ArrowUpRight size={15} aria-hidden="true" /></a></nav>
      </header>

      <MinimalHero>
        <div id="main-content" className="hero-content">
          <div className="hero-eyebrow"><span className="live-dot" /> Insurance, rewritten.</div>
          <h1 className="hero-wordmark" aria-label="Assurance. Insurance, rewritten."><span aria-hidden="true"><StrikethroughReplace from="in" to="as" /><span className="wordmark-rest">surance</span><span className="wordmark-dot">.</span></span></h1>
          <div className="hero-bottom">
            <div className="hero-message"><h2>Your claim.<br />Your corner.</h2><p>Insurance is complicated.<br />Getting help shouldn’t be.</p></div>
            <div className="hero-action"><a className="primary-button" href={workspaceUrl}><span>Let’s sort this out</span><span className="button-arrow"><ArrowUpRight size={21} aria-hidden="true" /></span></a><span className="action-note"><ShieldCheck size={13} aria-hidden="true" /> Your call. Every step of the way.</span></div>
          </div>
        </div>
        <div className="hero-footer"><span>Less runaround. More clarity.</span><a href="#how-it-works">A little less complicated <ArrowDown size={13} aria-hidden="true" /></a></div>
      </MinimalHero>

      <section id="how-it-works" className="how-section" aria-labelledby="how-heading">
        <div className="section-intro"><span className="section-label">The way forward</span><h2 id="how-heading">You’ve got enough<br />on your plate.</h2><p>One place for the paperwork.<br />One clear next step.</p></div>
        <div className="steps">{steps.map(step => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>)}</div>
      </section>

      <section className="questions" aria-label="Common questions"><h2>A few things to know.</h2><div><details><summary>What can I use Assurance for?<span aria-hidden="true">+</span></summary><p>The current prototype supports workplace injury cases and health-insurance disputes. Keep case details, documents, and proposed next steps together.</p></details><details><summary>Does Assurance send things automatically?<span aria-hidden="true">+</span></summary><p>No. Outreach requires an approved operator, an approved test recipient, and explicit authorization. No real claims are submitted.</p></details><details><summary>Can I try it with a real claim?<span aria-hidden="true">+</span></summary><p>Not yet. This is a prototype. Use synthetic injury, insurance, billing, and contact details only. Potential bill discrepancies are not verified savings.</p></details></div></section>

      <footer className="site-footer"><a className="brand" href="#">assurance<span className="brand-period">.</span></a><p>On your side. Not in your way.</p><span>Prototype · Synthetic data only</span></footer>
    </main>
  );
}
