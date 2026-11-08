// Signed-in overview (#workspace). Layout ideas from 21st.dev: "Stats Bento"
// (ui layout, MIT) for the mixed-size stat cards with a dark hatched lead card,
// "Stats cards with links" (Ephraim Duncan) for the linked attention card, and
// "KPI Tile" (OSAGI) for the compact metric. Restyled in the landing page's
// paper/ink/blue palette; the case list reuses the landing "How it works" rows.
import {useState, type ReactNode} from "react";
import {AnimatePresence, motion} from "motion/react";
import type {BillCase} from "../backend/schema";
import {PhoneIntakes} from "./PhoneIntakes";
import {ArrowUpRight, Plus} from "./Icons";
import {OWNER_LABEL, useProgressMap, type Owner, type Progress} from "./progress";
import {NumberTicker} from "./ui/motion";
import "./overview.css";

const ease = [0.16, 1, 0.3, 1] as const;
const money = (cents: number) => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(cents / 100);
const caseKind = (item: BillCase) => item.case_type === "workplace_injury" ? "Workplace injury" : "Health insurance";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ORDER: Record<Owner, number> = {you: 0, waiting: 1, done: 2};

type Filter = "all" | Owner;
const FILTERS: {id: Filter; label: string}[] = [{id: "all", label: "All"}, {id: "you", label: "Needs you"}, {id: "waiting", label: "Waiting"}, {id: "done", label: "Resolved"}];

function greeting(name: string) {
  const hour = new Date().getHours();
  return `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${name.split(" ")[0]}`;
}

function summary(total: number, you: number, done: number, loaded: boolean) {
  if (!loaded) return "Checking on your cases…";
  const handling = total - you - done;
  if (you === 0) return handling > 0 ? `Nothing needs you right now. Assurance is handling ${handling === 1 ? "your open case" : `all ${handling} open cases`}.` : "Nothing needs you right now.";
  return `${plural(you, "case")} ${you === 1 ? "needs" : "need"} you.${handling > 0 ? ` Assurance is handling the other ${handling === 1 ? "one" : handling}.` : ""}`;
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
        <p className="ov-summary" aria-live="polite">{summary(rows.length, counts.you, counts.done, loaded)}</p>
      </div>
      <div className="ov-head-side">
        {live}
        <a className="ov-cta" href="#new"><span>Open a case</span><span className="ov-cta-arrow"><ArrowUpRight size={20} aria-hidden="true"/></span></a>
      </div>
    </header>

    <PhoneIntakes userId={userId}/>

    <section className="ov-bento" aria-label="Case summary">
      <motion.article className="ov-card ov-savings" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, ease}}>
        <span className="ov-hatch" aria-hidden="true"/>
        <span className="ov-chip">Reported savings</span>
        <strong className="ov-savings-value"><NumberTicker value={saved} format={n => money(Math.round(n))}/></strong>
        <p>{saved ? `Across ${plural(savedCases, "case")}, from recorded insurer decisions.` : "Shows up once an insurer decision is recorded."}</p>
      </motion.article>

      <motion.div className="ov-card-slot" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.06, ease}}>
        {firstNeedingYou ? <a className="ov-card ov-attention" data-alert="true" href={`#case/${firstNeedingYou.item.id}`}>
          <span className="ov-card-label">Needs you</span>
          <strong className="ov-big">{counts.you}</strong>
          <span className="ov-attention-case">{firstNeedingYou.p!.title}<small>{firstNeedingYou.item.title}</small></span>
          <span className="ov-card-foot">Open {counts.you > 1 ? "the first one" : "it"}<ArrowUpRight size={14} aria-hidden="true"/></span>
        </a> : <div className="ov-card ov-attention">
          <span className="ov-card-label">Needs you</span>
          <strong className="ov-big">{loaded ? 0 : "–"}</strong>
          <span className="ov-attention-case">{loaded ? "You’re all caught up." : "Checking…"}<small>We’ll flag anything that needs you here.</small></span>
        </div>}
      </motion.div>

      <motion.article className="ov-card ov-mix" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.12, ease}}>
        <span className="ov-card-label">All cases</span>
        <strong className="ov-big">{rows.length}</strong>
        <span className="ov-meter" role="img" aria-label={`${counts.you} need you, ${counts.waiting} waiting, ${counts.done} resolved`}>
          {(["you", "waiting", "done"] as const).map(owner => counts[owner] > 0 && <motion.span key={owner} data-owner={owner}
            initial={{flexGrow: 0}} animate={{flexGrow: counts[owner]}} transition={{duration: 0.8, delay: 0.25, ease}}/>)}
        </span>
        <span className="ov-legend">
          {(["you", "waiting", "done"] as const).map(owner => <span key={owner} data-owner={owner}><i/>{counts[owner]} {OWNER_LABEL[owner].toLowerCase()}</span>)}
        </span>
      </motion.article>
    </section>

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
        {visible.length === 0 && <li className="ov-empty">No cases here right now.</li>}
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
