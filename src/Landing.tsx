import {PhoneEntry} from "./PhoneEntry";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Logo } from "./Icons";
import { HeroBackdrop } from "./components/hero-backdrop";
import { MinimalHero } from "./components/minimal-hero";
import { StrikethroughReplace } from "./components/strikethrough-replace";

const workspaceUrl = "#workspace";

const steps = [
  { number: "01", title: "Verify your number. Open your dashboard." },
  { number: "02", title: "Your advocate gathers the details." },
  { number: "03", title: "We handle the rest." },
];

// At the very top the backdrop photos fill the page and the divider lines hide;
// once the visitor scrolls, the photos shrink back to the header + hero area with faded edges.
function useBackdropLayout() {
  const pageRef = useRef<HTMLElement | null>(null);
  const [atTop, setAtTop] = useState(true);
  const [size, setSize] = useState({ header: 104, heroEnd: 0 });

  useEffect(() => {
    const page = pageRef.current;
    const header = page?.querySelector<HTMLElement>(".site-header");
    const hero = page?.querySelector<HTMLElement>(".minimal-root");
    if (!page || !header || !hero) return;
    const measure = () => setSize({ header: header.offsetHeight, heroEnd: hero.offsetTop + hero.offsetHeight });
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setAtTop(window.scrollY < 8));
    };
    measure();
    onScroll();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const style = { "--header-h": `${size.header}px`, ...(size.heroEnd ? { "--hero-end": `${size.heroEnd}px` } : {}) } as CSSProperties;
  return { pageRef, atTop, style };
}

export function Landing() {
  const backdrop = useBackdropLayout();
  return (
    <main ref={backdrop.pageRef} className={`landing-page phone-landing${backdrop.atTop ? " is-at-top" : ""}`} style={backdrop.style}>
      <HeroBackdrop />
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
            <div className="hero-action phone-hero-action"><PhoneEntry/></div>
          </div>
        </div>
      </MinimalHero>

      <section id="how-it-works" className="how-section" aria-labelledby="how-heading">
        <div className="section-intro"><h2 id="how-heading">You’ve got enough<br />on your plate.</h2></div>
        <div className="steps">{steps.map(step => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3></div></article>)}</div>
      </section>

      <footer className="site-footer"><a className="brand" href="#">assurance<span className="brand-period">.</span></a><span>Your case, handled.</span><span className="photo-credit">Hero photos: public domain, and <a href="https://commons.wikimedia.org/wiki/File:Man_on_Crutches_-_San_Cristobal_de_las_Casas_-_Chiapas_-_Mexico.jpg" target="_blank" rel="noreferrer">Adam Jones</a> (<a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a>), color adjusted.</span></footer>
    </main>
  );
}
