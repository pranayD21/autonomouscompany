// Adapted from Aceternity UI "File Upload" (ui.aceternity.com/components/file-upload, MIT).
// A real, labelled <input type="file"> stays inside the drop zone so keyboard users
// and tests keep working. Picking or dropping files hands them to onFiles at once.
import {useRef, useState, type DragEvent} from "react";
import {AnimatePresence, motion} from "motion/react";
import {FileIcon, Upload} from "../Icons";

export function FileDrop({label, hint, accept, disabled, busy, onFiles}: {label: string; hint: string; accept: string; disabled?: boolean; busy?: string | null; onFiles: (files: File[]) => void}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const off = disabled || !!busy;
  function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (files.length && !off) onFiles(files);
  }
  function drop(e: DragEvent) { e.preventDefault(); setDragging(false); take(e.dataTransfer.files); }
  return <motion.label className="file-drop" data-dragging={dragging} data-disabled={off} whileHover={off ? undefined : "lift"} initial="rest" animate={dragging ? "lift" : "rest"}
    onDragOver={e => { e.preventDefault(); if (!off) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <span className="file-drop-grid" aria-hidden="true"/>
    <span className="file-drop-stage">
      <AnimatePresence mode="popLayout" initial={false}>
        {busy ? <motion.span key="busy" layoutId="file-drop-card" className="file-drop-card file-drop-card--file" initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}}>
          <FileIcon size={16} aria-hidden="true"/><span className="file-drop-name">{busy}</span>
        </motion.span> : <motion.span key="empty" layoutId="file-drop-card" className="file-drop-card" variants={{rest: {x: 0, y: 0, rotate: 0}, lift: {x: 10, y: -10, rotate: -4}}} transition={{type: "spring", stiffness: 300, damping: 14}}>
          {dragging ? <span className="file-drop-now">Drop it</span> : <Upload size={18} aria-hidden="true"/>}
        </motion.span>}
      </AnimatePresence>
      {!busy && <motion.span className="file-drop-outline" aria-hidden="true" variants={{rest: {opacity: 0}, lift: {opacity: 1}}}/>}
    </span>
    <span className="file-drop-text"><span className="file-drop-title">{label}</span><span className="file-drop-hint">{hint}</span></span>
    <input ref={input} className="visually-hidden" type="file" multiple accept={accept} disabled={off} aria-label="Document file" onChange={e => take(e.target.files)}/>
  </motion.label>;
}
