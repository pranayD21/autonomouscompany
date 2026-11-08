import { ArrowUpRight, Logo } from "./Icons";
import { MinimalHero } from "./components/minimal-hero";
import { StrikethroughReplace } from "./components/strikethrough-replace";

const workspaceUrl = "#workspace";

const steps = [
  { number: "01", title: "Tell us what happened." },
  { number: "02", title: "Add your bills and EOBs." },
  { number: "03", title: "We handle the rest." },
];

export function Landing() {
  return (
    <main className="landing-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Assurance home"><Logo aria-hidden="true" />assurance<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation"><a className="nav-explain" href="#how-it-works">How it works</a><a className="nav-workspace" href={workspaceUrl}>Open workspace <ArrowUpRight size={15} aria-hidden="true" /></a></nav>
      </header>

      <MinimalHero>
        <div id="main-content" className="hero-content">
                    <h1 className="hero-wordmark" aria-label="Assurance"><span aria-hidden="true"><StrikethroughReplace from="in" to="as" fadeBelow=".hero-message h2" /><span className="wordmark-rest">surance</span><span className="wordmark-dot">.</span></span></h1>
          <div className="hero-bottom">
            <div className="hero-message"><h2>Insurance is complicated.<br /><span>Getting help shouldn’t be.</span></h2></div>
            <div className="hero-action"><a className="primary-button" href={workspaceUrl}><span className="button-label">Open a case</span><span className="button-arrow"><ArrowUpRight size={26} aria-hidden="true" /></span></a></div>
          </div>
        </div>
      </MinimalHero>

      <section id="how-it-works" className="how-section" aria-labelledby="how-heading">
        <div className="section-intro"><h2 id="how-heading">You’ve got enough<br />on your plate.</h2></div>
        <div className="steps">{steps.map(step => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3></div></article>)}</div>
      </section>

      <footer className="site-footer"><a className="brand" href="#">assurance<span className="brand-period">.</span></a><span>Your case, handled.</span></footer>
    </main>
  );
}
