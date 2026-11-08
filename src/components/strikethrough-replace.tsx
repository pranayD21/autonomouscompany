import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export interface StrikethroughReplaceProps {
  from: string;
  to: string;
  lineColor?: string;
  speed?: number;
  className?: string;
}

type Settle = { fromW: number; toW: number; dx: number; dy: number; inDy: number };

// Scale of the struck word once it drops below, and its approximate ink height
// (dot of the "i" to baseline) in em, used to tuck it just under the baseline.
const FROM_SCALE = 0.3;
const FROM_INK = 0.74;
// Extra room after the settled word: the script "s" tail runs past its advance.
const TO_GAP = 0.08;

// Phase 1 (CSS): strike through `from` and write `to` above it.
// Phase 2 (settle): `to` drops onto the baseline in place of `from`, and the
// struck `from` slides down below the word. Offsets are measured in em so the
// settled layout survives the wordmark's viewport-based font size changing.
export function StrikethroughReplace({ from, to, lineColor = "currentColor", speed = 1, className = "" }: StrikethroughReplaceProps) {
  const durationMs = 1400 / Math.max(0.01, speed);
  const root = useRef<HTMLSpanElement>(null);
  const fromEl = useRef<HTMLSpanElement>(null);
  const toEl = useRef<HTMLSpanElement>(null);
  const fromBase = useRef<HTMLSpanElement>(null);
  const toBase = useRef<HTMLSpanElement>(null);
  const [geo, setGeo] = useState<Settle | null>(null);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const r = root.current, f = fromEl.current, t = toEl.current, fb = fromBase.current, tb = toBase.current;
      if (cancelled || !r || !f || !t || !fb || !tb) return;
      const em = parseFloat(getComputedStyle(r).fontSize) || 1;
      // offsetTop/offsetLeft ignore transforms, so these are the untransformed positions.
      const fromBaseline = f.offsetTop + fb.offsetTop;
      const toBaseline = t.offsetTop + tb.offsetTop;
      const base = fb.offsetTop / em;
      setGeo({ fromW: f.offsetWidth / em, toW: tb.offsetLeft / em + TO_GAP, dx: -t.offsetLeft / em, dy: (fromBaseline - toBaseline) / em, inDy: base + 0.06 - FROM_SCALE * (base - FROM_INK) });
    };
    measure();
    // Web fonts change both words' metrics after first paint, so re-measure
    // whenever either word resizes rather than trusting the first layout.
    const ro = new ResizeObserver(measure);
    if (fromEl.current) ro.observe(fromEl.current);
    if (toEl.current) ro.observe(toEl.current);
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; ro.disconnect(); };
  }, [from, to]);

  const measured = geo !== null;
  useEffect(() => {
    if (!measured) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setSettled(true), reduce ? 0 : durationMs + 350);
    return () => window.clearTimeout(id);
  }, [measured, durationMs]);

  const styles = {
    "--replace-duration": `${durationMs}ms`,
    "--strike-color": lineColor,
    ...(geo && { width: `${settled ? geo.toW : geo.fromW}em`, "--settle-dx": `${geo.dx}em`, "--settle-dy": `${geo.dy}em`, "--settle-in-dy": `${geo.inDy}em`, "--settle-in-scale": FROM_SCALE }),
  } as CSSProperties;

  return <span ref={root} className={`strikethrough-replace${settled ? " is-settled" : ""} ${className}`} style={styles}>
    <span ref={fromEl} className="strike-from">{from}<span ref={fromBase} className="strike-baseline" /><span aria-hidden="true" className="strike-line" /></span>
    <span ref={toEl} className="strike-to">{to}<span ref={toBase} className="strike-baseline" /></span>
  </span>;
}
