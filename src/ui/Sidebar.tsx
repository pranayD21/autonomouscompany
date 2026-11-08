// Adapted from Aceternity UI "Sidebar" (ui.aceternity.com/components/sidebar, MIT):
// collapses to an icon rail on desktop and expands on hover or keyboard focus;
// becomes a slide-in sheet on mobile. Restyled for Assurance with plain CSS.
import {createContext, useContext, useEffect, useId, useRef, useState, type ReactNode} from "react";
import {AnimatePresence, motion, useReducedMotion} from "motion/react";
import {Logo, Close, Menu} from "../Icons";

const SidebarContext = createContext<{open: boolean; mobile: boolean; close: () => void}>({open: true, mobile: false, close: () => {}});
export const useSidebar = () => useContext(SidebarContext);

function useIsMobile() {
  const query = "(max-width: 820px)";
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMobile(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function Sidebar({children, footer}: {children: ReactNode; footer?: ReactNode}) {
  const mobile = useIsMobile();
  const [hover, setHover] = useState(false);
  const [sheet, setSheet] = useState(false);
  const sheetId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!mobile) setSheet(false);
    if (!sheet || !mobile) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(false);
      if (e.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    const close = () => setSheet(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", close);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [sheet, mobile]);

  useEffect(() => {
    if (!mobile) return;
    let start: {x: number; y: number; identifier: number; opening: boolean} | null = null;
    const selectedText = () => !!window.getSelection()?.toString();
    const onStart = (event: TouchEvent) => {
      start = null;
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || event.touches.length !== 1 || !touch || !target || selectedText() || document.querySelector(".chat-sheet")) return;
      if (target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="slider"], .ov-filters')) return;
      for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
        if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return;
      }
      const inSheet = !!sheetRef.current?.contains(target);
      if (sheet ? inSheet : touch.clientX >= 0 && touch.clientX <= 28) start = {x: touch.clientX, y: touch.clientY, identifier: touch.identifier, opening: !sheet};
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (event.defaultPrevented || event.touches.length !== 1 || !touch || touch.identifier !== start.identifier || selectedText()) { start = null; return; }
      const deltaX = touch.clientX - start.x, deltaY = touch.clientY - start.y;
      const distance = start.opening ? deltaX : -deltaX;
      if ((Math.abs(deltaY) > 10 && Math.abs(deltaY) >= Math.abs(deltaX)) || distance < -10) { start = null; return; }
      if (distance > 10 && distance > Math.abs(deltaY) * 1.5) {
        if (event.cancelable) event.preventDefault();
        if (distance > 56) { const opening = start.opening; start = null; setSheet(opening); }
      }
    };
    const onEnd = () => { start = null; };
    window.addEventListener("touchstart", onStart, {passive: true});
    window.addEventListener("touchmove", onMove, {passive: false});
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [mobile, sheet]);

  const brand = <a href="#home" className="sidebar-brand" aria-label="Assurance home"><span className="sidebar-brand-mark"><Logo size={24} aria-hidden="true"/></span><SidebarText className="sidebar-brand-word">assurance<span className="brand-period">.</span></SidebarText></a>;

  if (mobile) return <SidebarContext.Provider value={{open: true, mobile: true, close: () => setSheet(false)}}>
    <div className="mobile-bar">{brand}<button className="icon-button" aria-label="Open navigation" aria-expanded={sheet} aria-controls={sheet ? sheetId : undefined} onClick={() => setSheet(true)}><Menu/></button></div>
    <AnimatePresence>{sheet && <>
      <motion.div className="sheet-scrim" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={reduce ? {duration: 0} : undefined} onClick={() => setSheet(false)}/>
      <motion.nav ref={sheetRef} id={sheetId} className="sheet" role="dialog" aria-modal="true" aria-label="Workspace navigation" initial={{x: "-100%"}} animate={{x: 0}} exit={{x: "-100%"}} transition={reduce ? {duration: 0} : {duration: 0.3, ease: "easeInOut"}}>
        <div className="sheet-top">{brand}<button className="icon-button" aria-label="Close navigation" onClick={() => setSheet(false)}><Close/></button></div>
        <div className="sidebar-scroll">{children}</div>
        {footer && <div className="sidebar-footer">{footer}</div>}
      </motion.nav>
    </>}</AnimatePresence>
  </SidebarContext.Provider>;

  return <SidebarContext.Provider value={{open: hover, mobile: false, close: () => setHover(false)}}>
    <div className="sidebar-slot">
      <motion.nav aria-label="Workspace navigation" className="sidebar" data-open={hover}
        animate={{width: hover ? 300 : 76}} initial={false}
        transition={reduce ? {duration: 0} : {type: "spring", stiffness: 380, damping: 36}}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false); }}>
        {brand}
        <div className="sidebar-scroll">{children}</div>
        {footer && <div className="sidebar-footer">{footer}</div>}
      </motion.nav>
    </div>
  </SidebarContext.Provider>;
}

/** Text that fades in only while the rail is expanded. It stays in the accessibility tree. */
export function SidebarText({children, className = ""}: {children: ReactNode; className?: string}) {
  const {open} = useSidebar();
  return <motion.span className={`sidebar-text ${className}`} initial={false} animate={{opacity: open ? 1 : 0, x: open ? 0 : -6}} transition={{duration: 0.18}}>{children}</motion.span>;
}

export function SidebarLink({href, icon, label, active, onClick, meta}: {href?: string; icon: ReactNode; label: string; active?: boolean; onClick?: () => void; meta?: ReactNode}) {
  const {close, mobile} = useSidebar();
  const content = <>
    {active && <motion.span layoutId="sidebar-active" className="sidebar-active" transition={{type: "spring", stiffness: 420, damping: 34}}/>}
    <span className="sidebar-icon">{icon}</span>
    <SidebarText className="sidebar-label">{label}</SidebarText>
    {meta && <SidebarText className="sidebar-meta">{meta}</SidebarText>}
  </>;
  const handle = () => { onClick?.(); if (mobile) close(); };
  return href
    ? <a className="sidebar-link" href={href} aria-current={active ? "page" : undefined} onClick={handle}>{content}</a>
    : <button type="button" className="sidebar-link" aria-current={active ? "page" : undefined} onClick={handle}>{content}</button>;
}

export function SidebarSection({label}: {label: string}) {
  return <p className="sidebar-section"><SidebarText>{label}</SidebarText></p>;
}
