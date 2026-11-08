// Adapted from Aceternity UI "File Upload" (ui.aceternity.com/components/file-upload, MIT),
// shrunk to a pill. A real, labelled <input type="file"> stays inside so keyboard users
// and tests keep working. Picking or dropping files hands them to onFiles at once.
import {useRef, useState, type DragEvent} from "react";
import {AnimatePresence, motion} from "motion/react";
import {Upload} from "../Icons";

const spring = {type: "spring", stiffness: 420, damping: 12} as const;

export function FileDrop({label, accept, disabled, busy, onFiles}: {label: string; accept: string; disabled?: boolean; busy?: string | null; onFiles: (files: File[]) => void}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const off = disabled || !!busy;
  function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (files.length && !off) onFiles(files);
  }
  function drop(e: DragEvent) { e.preventDefault(); setDragging(false); take(e.dataTransfer.files); }
  return <motion.label className="file-drop" data-dragging={dragging} data-disabled={off} title="Drop files here or click to choose"
    whileHover={off ? undefined : "lift"} whileTap={off ? undefined : "press"} initial="rest" animate={dragging ? "lift" : busy ? "busy" : "rest"}
    onDragOver={e => { e.preventDefault(); if (!off) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <span className="file-drop-stage" aria-hidden="true">
      <motion.span className="file-drop-outline" variants={{rest: {opacity: 0, scale: .8}, lift: {opacity: 1, scale: 1}, press: {opacity: 1, scale: 1}, busy: {opacity: 0}}} transition={{duration: .15}}/>
      <motion.span className="file-drop-card" transition={spring}
        variants={{rest: {x: 0, y: 0, rotate: 0}, lift: {x: 4, y: -4, rotate: -10}, press: {x: 0, y: 0, rotate: 0, scale: .9}, busy: {y: [0, -3, 0], transition: {duration: .8, repeat: Infinity}}}}>
        <Upload size={14}/>
      </motion.span>
    </span>
    <span className="file-drop-label">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={busy ?? (dragging ? "drop" : "idle")} initial={{opacity: 0, y: 4}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -4}} transition={{duration: .15}}>
          {busy ?? (dragging ? "Drop to upload" : label)}
        </motion.span>
      </AnimatePresence>
    </span>
    <input ref={input} className="visually-hidden" type="file" multiple accept={accept} disabled={off} aria-label="Document file" onChange={e => take(e.target.files)}/>
  </motion.label>;
}
