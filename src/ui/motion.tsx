import {useEffect, useRef, useState} from "react";
import {animate, useReducedMotion} from "motion/react";

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
