// Signed-in overview (#workspace). One plain summary card (Needs you / In progress /
// Reported savings) styled like the case list, in the landing page's paper/ink/blue
// palette; the case list reuses the landing "How it works" rows.
import {useState, type ReactNode} from "react";
import {AnimatePresence, motion} from "motion/react";
import type {BillCase} from "../backend/schema";
import {PhoneIntakes} from "./PhoneIntakes";
import {ArrowUpRight, Check, Clock, Plus} from "./Icons";
import {OWNER_LABEL, useProgressMap, type Owner, type Progress} from "./progress";
import {NumberTicker} from "./ui/motion";
import {isPersonName} from "./format";
import "./overview.css";

const ease = [0.16, 1, 0.3, 1] as const;
// Whole dollars when the amount has no cents or is $1,000 or more ("$400", "$12,900"); otherwise "$412.37".
const wholeDollars = (cents: number) => cents % 100 === 0 || cents >= 100000;
const money = (cents: number, whole = wholeDollars(cents)) => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", ...(whole ? {maximumFractionDigits: 0, minimumFractionDigits: 0} : {})}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ORDER: Record<Owner, number> = {you: 0, waiting: 1, done: 2};

type Filter = "all" | Owner;
const FILTERS: {id: Filter; label: string}[] = [{id: "all", label: "All"}, {id: "you", label: "Needs you"}, {id: "waiting", label: "Waiting"}, {id: "done", label: "Resolved"}];

const EMPTY: Record<Filter, [string, string]> = {
  all: ["No cases yet.", "Open a case and Assurance takes it from there."],
  you: ["Nothing needs you right now.", "We’ll flag anything that does."],
  waiting: ["Nothing in progress.", "Cases Assurance is working on show up here."],
  done: ["No resolved cases yet.", "Finished cases show up here."],
};

function greeting(name: string) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  // Phone-only and email-only accounts have no real name; greet them without echoing the number or address.
  return isPersonName(name) ? `${salutation}, ${name.trim().split(/\s+/)[0]}` : salutation;
}

export function Overview({cases, userId, userName, crewEnabled, live}: {cases: readonly BillCase[]; userId: string; userName: string; crewEnabled: boolean; live: ReactNode}) {
  const progress = useProgressMap(cases, userId, crewEnabled);
  const [filter, setFilter] = useState<Filter>("all");
  const [hovered, setHovered] = useState<string | null>(null);

  const rows = cases.map(item => ({item, p: progress.get(item.id)}))
    .sort((a, b) => (a.p?.loaded ? ORDER[a.p.owner] : 3) - (b.p?.loaded ? ORDER[b.p.owner] : 3));
  const loaded = rows.every(r => r.p?.loaded);
  const count = (owner: Owner) => rows.filter(r => r.p?.loaded && r.p.owner === owner).length;
  const counts: Record<Filter, number> = {all: rows.length, you: count("you"), waiting: count("waiting"), done: count("done")};
  const saved = rows.reduce((sum, r) => sum + (r.p?.outcome?.reduction_cents ?? 0), 0);
  const savedCases = rows.filter(r => (r.p?.outcome?.reduction_cents ?? 0) > 0).length;
  const firstNeedingYou = rows.find(r => r.p?.loaded && r.p.owner === "you");
  const visible = filter === "all" ? rows : rows.filter(r => r.p?.loaded && r.p.owner === filter);

  return <div className="ov">
    <header className="ov-head">
      <div>
        <p className="eyebrow">{greeting(userName)}</p>
        <h1 className="ov-title">Your cases<span className="ov-dot">.</span></h1>
      </div>
      <div className="ov-head-side">
        {live}
        <a className="ov-cta" href="#new"><span>Open a case</span><span className="ov-cta-arrow"><ArrowUpRight size={20} aria-hidden="true"/></span></a>
      </div>
    </header>

    <PhoneIntakes userId={userId}/>

    <motion.section className="ov-stats" aria-label="Case summary" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{duration: 0.4, ease}}>
      {firstNeedingYou
        ? <a className="ov-stat" data-alert="true" href={`#case/${firstNeedingYou.item.id}`} aria-label={`${counts.you} ${counts.you === 1 ? "case needs" : "cases need"} you. Open ${firstNeedingYou.item.title}`}>
            <span className="ov-stat-label">Needs you</span>
            <strong className="ov-stat-value">{counts.you}</strong>
            <span className="ov-stat-foot">Open<ArrowUpRight size={13} aria-hidden="true"/></span>
          </a>
        : <div className="ov-stat">
            <span className="ov-stat-label">Needs you</span>
            <strong className="ov-stat-value">{loaded ? 0 : "–"}</strong>
            <span className="ov-stat-foot">{loaded ? "All caught up" : "Checking…"}</span>
          </div>}
      <div className="ov-stat">
        <span className="ov-stat-label">In progress</span>
        <strong className="ov-stat-value">{loaded ? counts.waiting : "–"}</strong>
        <span className="ov-stat-foot">{counts.done ? `${counts.done} resolved` : "Assurance is on it"}</span>
      </div>
      <div className="ov-stat ov-stat--savings">
        <span className="ov-stat-label">Reported savings</span>
        <strong className="ov-stat-value"><NumberTicker value={saved} format={n => money(Math.round(n), wholeDollars(saved))}/></strong>
        <span className="ov-stat-foot">{saved ? `From ${plural(savedCases, "insurer decision")}` : "None recorded yet"}</span>
      </div>
    </motion.section>

    <section className="ov-list" aria-labelledby="ov-list-heading">
      <div className="ov-list-head">
        <h2 id="ov-list-heading">Cases</h2>
        <div className="ov-filters" role="tablist" aria-label="Filter cases">
          {FILTERS.map(f => <button key={f.id} role="tab" aria-selected={filter === f.id} className="ov-filter" onClick={() => setFilter(f.id)}>
            {filter === f.id && <motion.span layoutId="ov-filter-pill" className="ov-filter-pill" transition={{type: "spring", bounce: 0.18, duration: 0.45}}/>}
            <span>{f.label}</span><span className="ov-filter-count">{counts[f.id]}</span>
          </button>)}
        </div>
      </div>

      <ol className="ov-rows" onMouseLeave={() => setHovered(null)}>
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map(({item, p}, i) => <motion.li key={item.id} layout initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} exit={{opacity: 0}} transition={{duration: 0.35, delay: 0.04 * i, ease}}>
            <CaseRow item={item} p={p} index={i} hovered={hovered === item.id} onHover={() => setHovered(item.id)}/>
          </motion.li>)}
        </AnimatePresence>
        {visible.length === 0 && <li className="ov-empty">
          <span className="ov-empty-icon" aria-hidden="true">{filter === "you" || filter === "all" ? <Check size={16}/> : <Clock size={16}/>}</span>
          <strong>{EMPTY[filter][0]}</strong>
          <span>{EMPTY[filter][1]}</span>
        </li>}
      </ol>
      <a className="ov-new" href="#new"><span className="ov-new-plus" aria-hidden="true"><Plus size={16}/></span>Open another case</a>
    </section>
  </div>;
}

function CaseRow({item, p, index, hovered, onHover}: {item: BillCase; p?: Progress; index: number; hovered: boolean; onHover: () => void}) {
  const counterpart = item.intake?.insurer_name || item.intake?.employer_name;
  return <a className="ov-row" href={`#case/${item.id}`} data-owner={p?.loaded ? p.owner : undefined} onMouseEnter={onHover} onFocus={onHover}>
    <AnimatePresence>{hovered && <motion.span className="ov-row-hover" layoutId="ov-row-hover" initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: 0.15}}} exit={{opacity: 0, transition: {duration: 0.15, delay: 0.08}}}/>}</AnimatePresence>
    <span className="ov-row-num">{String(index + 1).padStart(2, "0")}</span>
    <span className="ov-row-main">
      <span className="ov-row-kind">{caseKind(item)}{counterpart ? ` · ${counterpart}` : ""}</span>
      <strong className="ov-row-title">{item.title}</strong>
      <span className="ov-row-status">{p?.loaded ? p.title : <span className="ov-skeleton"/>}</span>
    </span>
    <span className="ov-row-side">
      {p?.loaded ? <span className="badge" data-owner={p.owner}><span className="badge-dot"/>{OWNER_LABEL[p.owner]}</span> : <span className="ov-skeleton ov-skeleton--badge"/>}
      {p?.outcome?.reduction_cents ? <span className="ov-row-saved">{money(p.outcome.reduction_cents)} reported</span> : null}
    </span>
    <span className="ov-row-arrow" aria-hidden="true"><ArrowUpRight size={18}/></span>
  </a>;
}
