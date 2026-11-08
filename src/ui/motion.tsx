// Animation primitives adapted from Aceternity UI (ui.aceternity.com, MIT):
// Text Generate Effect, Stateful Button, Timeline and Multi Step Loader.
// Rewritten for this app's plain-CSS theme (no Tailwind) and to keep
// accessible names stable for screen readers and Playwright tests.
import {useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode} from "react";
import {AnimatePresence, animate, motion, stagger, useAnimate, useReducedMotion} from "motion/react";
import {Check, Spinner} from "../Icons";

/** Aceternity "Text Generate Effect": words fade in from a blur, one after another. */
export function TextGenerate({text, className, as: Tag = "p", wordDelay = 0.035}: {text: string; className?: string; as?: "p" | "h1" | "span"; wordDelay?: number}) {
  const [scope, run] = useAnimate();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || !scope.current) return;
    void run("span", {opacity: 1, filter: "blur(0px)"}, {duration: 0.45, delay: stagger(wordDelay)});
  }, [text, reduce]);
  const words = text.split(/(\s+)/);
  return <Tag ref={scope} className={className}>{words.map((word, i) => /^\s+$/.test(word) ? word : <motion.span key={`${word}-${i}`} style={reduce ? undefined : {opacity: 0, filter: "blur(8px)"}}>{word}</motion.span>)}</Tag>;
}

/** Counts up to a value when it changes (Aceternity / Magic UI number ticker pattern). */
export function NumberTicker({value, format}: {value: number; format: (n: number) => string}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(from.current, value, {duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay});
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <>{format(display)}</>;
}

/**
 * Aceternity "Stateful Button": a spinner grows in while the action runs, then a
 * check confirms success. The label stays constant so the button's name never changes.
 */
export function StatefulButton({onAction, children, className = "", disabled, ...props}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {onAction: () => Promise<boolean | void>; children: ReactNode}) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  async function click() {
    if (state === "loading") return;
    setState("loading");
    let ok = false;
    try { ok = (await onAction()) !== false; } catch { ok = false; }
    if (!mounted.current) return;
    setState(ok ? "success" : "idle");
    if (ok) setTimeout(() => { if (mounted.current) setState("idle"); }, 1800);
  }
  return <motion.button layout type="button" className={`stateful-button ${className}`} data-state={state} disabled={disabled || state === "loading"} aria-busy={state === "loading"} onClick={() => void click()} {...(props as object)}>
    <AnimatePresence initial={false} mode="popLayout">
      {state === "loading" && <motion.span key="spin" className="stateful-icon" aria-hidden="true" initial={{width: 0, opacity: 0, scale: 0}} animate={{width: 18, opacity: 1, scale: 1}} exit={{width: 0, opacity: 0, scale: 0}}><motion.span style={{display: "flex"}} animate={{rotate: 360}} transition={{repeat: Infinity, duration: 0.7, ease: "linear"}}><Spinner size={18}/></motion.span></motion.span>}
      {state === "success" && <motion.span key="check" className="stateful-icon" aria-hidden="true" initial={{width: 0, opacity: 0, scale: 0}} animate={{width: 18, opacity: 1, scale: 1}} exit={{width: 0, opacity: 0, scale: 0}}><Check size={18}/></motion.span>}
    </AnimatePresence>
    <motion.span layout className="stateful-label">{children}</motion.span>
  </motion.button>;
}

/** Timeline rail for outcome and decision history (Aceternity Timeline layout, static). */
export function Timeline({children, className = ""}: {children: ReactNode; className?: string}) {
  return <div className={`timeline ${className}`}><div className="timeline-rail" aria-hidden="true"/>{children}</div>;
}

export function TimelineItem({children, label}: {children: ReactNode; label?: ReactNode}) {
  return <motion.div className="timeline-item">
    <span className="timeline-dot" aria-hidden="true"/>
    {label && <p className="timeline-label">{label}</p>}
    {children}
  </motion.div>;
}

/** Aceternity "Multi Step Loader", inline: cycles through the steps the agent is working on. */
export function StepLoader({steps, interval = 2200}: {steps: string[]; interval?: number}) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const timer = setInterval(() => setIndex(i => Math.min(i + 1, steps.length - 1)), interval);
    return () => clearInterval(timer);
  }, [steps.length, interval]);
  return <ol className="step-loader" aria-label="Review progress">
    {steps.map((step, i) => <motion.li key={step} data-state={i < index ? "done" : i === index ? "active" : "todo"} initial={reduce ? false : {opacity: 0, x: -8}} animate={{opacity: i > index ? 0.4 : 1, x: 0}} transition={{delay: reduce ? 0 : i * 0.06}}>
      <span className="step-loader-mark" aria-hidden="true">{i < index ? <Check size={13}/> : i === index ? <motion.span className="step-loader-pulse" animate={reduce ? undefined : {scale: [1, 1.5, 1], opacity: [1, 0.4, 1]}} transition={{repeat: Infinity, duration: 1.4}}/> : null}</span>
      {step}
    </motion.li>)}
  </ol>;
}

/** Fades and lifts content in as it enters the viewport. */
export function Reveal({children, delay = 0, className, id, as = "section", ariaLabel}: {children: ReactNode; delay?: number; className?: string; id?: string; as?: "section" | "div"; ariaLabel?: string}) {
  const Comp = as === "section" ? motion.section : motion.div;
  return <Comp id={id} aria-label={ariaLabel} className={className} initial={{opacity: 0, y: 18}} whileInView={{opacity: 1, y: 0}} viewport={{once: true, margin: "-60px"}} transition={{duration: 0.55, delay, ease: [0.16, 1, 0.3, 1]}}>{children}</Comp>;
}
