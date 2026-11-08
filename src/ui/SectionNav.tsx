// Section navigation using the sliding-pill motion from Aceternity UI "Animated Tabs"
// (MIT). Every section stays rendered, so the pill tracks the section in view
// and clicking one scrolls to it.
import {useEffect, useState} from "react";
import {motion} from "motion/react";

export function SectionNav({sections}: {sections: {id: string; label: string}[]}) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity);
      const first = [...visible.entries()].filter(([, top]) => top !== Infinity).sort((a, b) => a[1] - b[1])[0];
      if (first) setActive(first[0]);
    }, {rootMargin: "-20% 0px -60% 0px"});
    for (const section of sections) { const el = document.getElementById(section.id); if (el) observer.observe(el); }
    return () => observer.disconnect();
  }, [sections.map(s => s.id).join()]);
  return <nav className="section-nav" aria-label="Case sections">
    {sections.map(section => <a key={section.id} href={`#${section.id}`} className="section-nav-item" aria-current={active === section.id ? "true" : undefined}
      onClick={e => { e.preventDefault(); setActive(section.id); document.getElementById(section.id)?.scrollIntoView({behavior: "smooth", block: "start"}); }}>
      {active === section.id && <motion.span layoutId="section-pill" className="section-nav-pill" transition={{type: "spring", bounce: 0.25, duration: 0.5}}/>}
      <span>{section.label}</span>
    </a>)}
  </nav>;
}
