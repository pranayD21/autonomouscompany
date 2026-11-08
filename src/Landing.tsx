import {PhoneEntry} from "./PhoneEntry";
import { ArrowUpRight, Asterisk, ShieldCheck } from "./Icons";
import { MinimalHero } from "./components/minimal-hero";
import { StrikethroughReplace } from "./components/strikethrough-replace";

const workspaceUrl = "#workspace";

const steps = [
  { number: "01", title: "Verify your number. Open your dashboard." },
  { number: "02", title: "Your advocate gathers the details." },
  { number: "03", title: "Follow the work in your case workspace." },
];

export function Landing() {
  return (
    <main className="landing-page phone-landing">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Assurance home"><Asterisk strokeWidth={2.5} aria-hidden="true" />assurance<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation"><a className="nav-explain" href="#how-it-works">How it works</a><a className="nav-workspace" href={workspaceUrl}>Open workspace <ArrowUpRight size={15} aria-hidden="true" /></a></nav>
      </header>

      <MinimalHero>
        <div id="main-content" className="hero-content">
                    <h1 className="hero-wordmark" aria-label="Assurance"><span aria-hidden="true"><StrikethroughReplace from="in" to="as" /><span className="wordmark-rest">surance</span><span className="wordmark-dot">.</span></span></h1>
          <div className="hero-bottom">
            <div className="hero-message"><h2>Insurance is complicated.<br /><span>Getting help shouldn’t be.</span></h2></div>
            <div className="hero-action phone-hero-action"><PhoneEntry/><span className="action-note"><ShieldCheck size={13} aria-hidden="true" /> You can stop agent work anytime.</span></div>
          </div>
        </div>
      </MinimalHero>

      <section id="how-it-works" className="how-section" aria-labelledby="how-heading">
        <div className="section-intro"><h2 id="how-heading">You’ve got enough<br />on your plate.</h2></div>
        <div className="steps">{steps.map(step => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3></div></article>)}</div>
      </section>

      <section className="questions" aria-label="Common questions"><h2>Questions</h2><div><details><summary>What can I use Assurance for?<span aria-hidden="true">+</span></summary><p>Workplace injury claims and health-insurance disputes.</p></details><details><summary>Does Assurance send things automatically?<span aria-hidden="true">+</span></summary><p>Yes. Your advocate researches, contacts relevant organizations, and follows up under your case scope. You can stop the work anytime.</p></details><details><summary>How will I hear from my advocate?<span aria-hidden="true">+</span></summary><p>When onboarding calls are available, request a call and verify your phone number. Then follow your cases, message your advocate, and upload documents in your dashboard.</p></details></div></section>

      <footer className="site-footer"><a className="brand" href="#">assurance<span className="brand-period">.</span></a><span>Your case, handled.</span></footer>
    </main>
  );
}
