import type { CSSProperties } from "react";

export interface StrikethroughReplaceProps {
  from: string;
  to: string;
  lineColor?: string;
  speed?: number;
  className?: string;
}

export function StrikethroughReplace({ from, to, lineColor = "currentColor", speed = 1, className = "" }: StrikethroughReplaceProps) {
  const durationMs = 1400 / Math.max(0.01, speed);
  const styles = { "--replace-duration": `${durationMs}ms`, "--strike-color": lineColor } as CSSProperties;

  return <span className={`strikethrough-replace ${className}`} style={styles}><span className="strike-from">{from}<span aria-hidden="true" className="strike-line" /></span><span className="strike-to">{to}</span></span>;
}
