import {useEffect, useId, useRef, type FormEvent, type ReactNode} from "react";
import {FileIcon} from "../Icons";

export function ClaimComposer({value, onChange, onSubmit, busy, needsAnswer, disabled = false, readOnly = false, sendLabel = "Send response", attachment}: {value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; needsAnswer: boolean; disabled?: boolean; readOnly?: boolean; sendLabel?: string; attachment?: ReactNode}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const messageId = useId(), hintId = useId();

  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = "auto";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 200)}px`;
  }, [value]);

  function openDocuments() {
    const section = document.getElementById("section-documents");
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({block: "center"});
    section?.querySelector<HTMLElement>('summary')?.focus({preventScroll: true});
  }

  return <form className="claim-composer-form" onSubmit={onSubmit} aria-label="Message Assurance" aria-busy={busy}>
    <div className="claim-composer">
      <label className="visually-hidden" htmlFor={messageId}>Message Assurance</label>
      <textarea ref={textarea} id={messageId} value={value} onChange={event => onChange(event.target.value)} disabled={busy || disabled} readOnly={readOnly} required maxLength={4000} rows={2}
        placeholder={needsAnswer ? "Share your answer with Assurance…" : "Add an update or ask about your claim…"}
        aria-describedby={hintId}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (!busy && !disabled && value.trim()) event.currentTarget.form?.requestSubmit();
          }
        }}/>
      <div className="claim-composer-toolbar">
        {attachment ?? <button className="claim-document-link" type="button" onClick={openDocuments} disabled={busy} title="Go to case documents"><FileIcon size={17} aria-hidden="true"/><span>Case documents</span></button>}
        {value.length >= 3600 && <span className="claim-composer-count" aria-hidden="true">{value.length.toLocaleString()} / 4,000</span>}
        <button className="claim-send" type="submit" disabled={busy || disabled || !value.trim()} aria-label={busy ? "Saving response" : sendLabel} title={busy ? "Saving response" : sendLabel}>
          {busy ? <span className="claim-send-spinner" aria-hidden="true"/> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>}
        </button>
      </div>
    </div>
    <p id={hintId} className="claim-composer-hint">Only for this claim. <span>Enter to send · Shift + Enter for a new line</span></p>
  </form>;
}
