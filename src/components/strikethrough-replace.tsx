import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export interface StrikethroughReplaceProps {
  from: string;
  to: string;
  lineColor?: string;
  speed?: number;
  className?: string;
  /** Selector for content below the word: the struck word slides behind it and fades out before reaching it. */
  fadeBelow?: string;
}

type Settle = { fromW: number; toW: number; dx: number; dy: number; inDy: number; fadeStart: number; fadeEnd: number };

// Extra room after the settled word: the script "s" tail runs past its advance.
const TO_GAP = 0.11;
// Gap between the settled word's baseline and the top of the dropped word's ink, in em.
const FROM_DROP_GAP = 0.06;
// Horizontal padding on the struck word (cancelled by negative margin in CSS) so
// its fade mask also covers the strike line, which overhangs the letters.
const FROM_PAD = 0.12;

// Ink extent above (asc) and below (desc) the baseline for `text` in `el`'s font, in px.
function inkBox(el: Element, text: string) {
  const s = getComputedStyle(el);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  const m = ctx.measureText(text);
  return { asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}

// Phase 1 (CSS): strike through `from` and write `to` above it.
// Phase 2 (settle): `to` drops into line, vertically centred on the rest of the
// word, and the struck `from` slides down behind the content below, fading out
// before it reaches it. Offsets are in em so they follow the viewport-based font size.
export function StrikethroughReplace({ from, to, lineColor = "currentColor", speed = 1, className = "", fadeBelow }: StrikethroughReplaceProps) {
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
      // Centre the replacement's ink on the rest of the word's x-height band.
      const rest = r.nextElementSibling, restInk = rest && inkBox(rest, rest.textContent || "x"), toInk = inkBox(t, to);
      const centring = restInk && toInk ? ((toInk.asc - toInk.desc) - (restInk.asc - restInk.desc)) / 2 : 0;
      const fromInk = inkBox(f, from);
      const base = fb.offsetTop;
      const inDy = (fromInk?.asc ?? 0.74 * em) + FROM_DROP_GAP * em;
      // Fade the dropped word from just under the baseline to fully gone at the content below.
      const below = fadeBelow ? document.querySelector(fadeBelow) : null;
      const rootTop = r.getBoundingClientRect().top;
      const belowGap = below ? below.getBoundingClientRect().top - (rootTop + fromBaseline) : 0.45 * em;
      setGeo({
        fromW: f.offsetWidth / em - FROM_PAD * 2, toW: tb.offsetLeft / em + TO_GAP, dx: -t.offsetLeft / em,
        dy: (fromBaseline - toBaseline + centring) / em, inDy: inDy / em,
        // Mask stops in the struck word's resting box; CSS offsets them by its
        // current slide so the fade stays fixed on the page while it moves.
        fadeStart: (base + FROM_DROP_GAP * em) / em, fadeEnd: (base + Math.max(belowGap, 0.2 * em)) / em,
      });
    };
    measure();
    // Web fonts change both words' metrics after first paint, so re-measure
    // whenever either word resizes rather than trusting the first layout.
    const ro = new ResizeObserver(measure);
    if (fromEl.current) ro.observe(fromEl.current);
    if (toEl.current) ro.observe(toEl.current);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [from, to, fadeBelow]);

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
    ...(geo && {
      width: `${settled ? geo.toW : geo.fromW}em`,
      "--settle-dx": `${geo.dx}em`, "--settle-dy": `${geo.dy}em`, "--settle-in-dy": `${geo.inDy}em`,
      "--fade-start": `${geo.fadeStart}em`, "--fade-end": `${geo.fadeEnd}em`,
    }),
  } as CSSProperties;

  return <span ref={root} className={`strikethrough-replace${settled ? " is-settled" : ""} ${className}`} style={styles}>
    <span ref={fromEl} className="strike-from">{from}<span ref={fromBase} className="strike-baseline" /><span aria-hidden="true" className="strike-line" /></span>
    <span ref={toEl} className="strike-to">{to}<span ref={toBase} className="strike-baseline" /></span>
  </span>;
}
