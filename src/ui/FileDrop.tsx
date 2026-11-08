// Adapted from Aceternity UI "File Upload" (ui.aceternity.com/components/file-upload, MIT).
// Keeps a real, labelled <input type="file"> inside the form so FormData, keyboard
// users and tests keep working; dropping a file assigns it to that input.
import {useRef, useState, type DragEvent} from "react";
import {AnimatePresence, motion} from "motion/react";
import {FileIcon, Upload} from "../Icons";

export function FileDrop({name, label, accept, disabled, resetKey, onPick}: {name: string; label: string; accept: string; disabled?: boolean; resetKey?: string; onPick?: () => void}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lastReset, setLastReset] = useState(resetKey);
  if (resetKey !== lastReset) { setLastReset(resetKey); setFile(null); }
  function drop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    if (disabled || !input.current || !e.dataTransfer.files.length) return;
    const transfer = new DataTransfer(); transfer.items.add(e.dataTransfer.files[0]);
    input.current.files = transfer.files;
    setFile(transfer.files[0]); onPick?.();
  }
  return <motion.label className="file-drop" data-dragging={dragging} data-disabled={disabled} whileHover={disabled ? undefined : "lift"} initial="rest" animate={dragging ? "lift" : "rest"}
    onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    <span className="file-drop-grid" aria-hidden="true"/>
    <span className="file-drop-title">{label}</span>
    <span className="file-drop-hint">Drag a file here, or click to choose</span>
    <input ref={input} className="visually-hidden" name={name} type="file" accept={accept} required disabled={disabled} aria-label={label}
      onChange={e => { setFile(e.target.files?.[0] ?? null); onPick?.(); }}/>
    <span className="file-drop-stage">
      <AnimatePresence mode="popLayout" initial={false}>
        {file ? <motion.span key="file" layoutId="file-drop-card" className="file-drop-card file-drop-card--file" initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}}>
          <FileIcon size={18} aria-hidden="true"/><span className="file-drop-name">{file.name}</span><span className="file-drop-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        </motion.span> : <motion.span key="empty" layoutId="file-drop-card" className="file-drop-card" variants={{rest: {x: 0, y: 0}, lift: {x: 14, y: -14}}} transition={{type: "spring", stiffness: 300, damping: 20}}>
          {dragging ? <span className="file-drop-now">Drop it</span> : <Upload size={18} aria-hidden="true"/>}
        </motion.span>}
      </AnimatePresence>
      {!file && <motion.span className="file-drop-outline" aria-hidden="true" variants={{rest: {opacity: 0}, lift: {opacity: 1}}}/>}
    </span>
  </motion.label>;
}
