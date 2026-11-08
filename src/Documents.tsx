import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {api, auth} from "./services";
import type {DocumentExtraction} from "../backend/providers/document-reader";
import type {CaseDocument} from "../backend/schema";
import {AnimatePresence, motion} from "motion/react";
import {FileIcon} from "./Icons";
import {FileDrop} from "./ui/FileDrop";

type DocumentView = Omit<CaseDocument, "object_key"> & {extraction_state: string | null; extraction_result: DocumentExtraction | null; extraction_error: string | null; confirmed_at: string | null};
const READING = ["running", "preparing", "direct_running"];
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

function readingLabel(doc: DocumentView) {
  if (doc.state !== "ready") return "Upload incomplete. Add the same file again.";
  if (doc.confirmed_at) return "Read and confirmed";
  if (doc.extraction_result) return "Read";
  if (READING.includes(doc.extraction_state ?? "")) return "Reading…";
  if (doc.extraction_error) return "Couldn’t read this file";
  return "Not read yet";
}

const DocumentContext = createContext<ReturnType<typeof useDocumentManager> | null>(null);

export function CaseDocumentsProvider({caseId, userId, revision, children}: {caseId: string; userId: string; revision: number; children: ReactNode}) {
  const manager = useDocumentManager(caseId, userId, revision);
  return <DocumentContext.Provider value={manager}>{children}</DocumentContext.Provider>;
}

export function useDocumentCount() { return useDocuments().docs.length; }

function useDocuments() {
  const manager = useContext(DocumentContext);
  if (!manager) throw new Error("Case documents must be inside their case provider.");
  return manager;
}

function useDocumentManager(caseId: string, userId: string, revision: number) {
  const [docs, setDocs] = useState<DocumentView[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [uploading, setUploading] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState("");
  const inFlight = useRef(false);
  const path = `/cases/${caseId}/documents`;
  async function refresh() { setDocs(await api(path, {}, userId)); }
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [caseId, userId, revision]);

  async function upload(files: File[]) {
    if (inFlight.current || !files.length) return;
    inFlight.current = true;
    setBusy(true); setError(""); setUploadNotice("");
    try {
      for (const [n, file] of files.entries()) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
        setUploading(files.length > 1 ? `Uploading ${n + 1} of ${files.length}: ${file.name}` : `Uploading ${file.name}`);
        const id = crypto.randomUUID(), body = new FormData();
        body.set("file", file); body.set("kind", "other"); body.set("id", id);
        await api(path, {method: "POST", body}, userId);
        await api(`${path}/${id}/extraction`, {method: "POST"}, userId);
      }
      setUploadNotice(`${files.length === 1 ? files[0].name : `${files.length} files`} added. Document reading requested.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Try the same file again."); }
    finally { await refresh().catch(() => {}); setUploading(null); setBusy(false); inFlight.current = false; }
  }
  async function download(doc: DocumentView) {
    setError("");
    try {
      const session = await auth.getSession();
      if (session.data?.user.id !== userId) throw new Error("Please sign in again.");
      const response = await fetch(`${import.meta.env.VITE_CASES_API_URL}${path}/${doc.id}/download`, {headers: {Authorization: `Bearer ${session.data.session.token}`}});
      if (!response.ok) throw new Error("Document download failed.");
      const url = URL.createObjectURL(await response.blob()), a = document.createElement("a");
      a.href = url; a.download = doc.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  }
  async function extract(id: string, action: "start" | "refresh" | "confirm") {
    setBusy(true); setError("");
    try { await api(`${path}/${id}/extraction${action === "start" ? "" : `/${action}`}`, {method: "POST", ...(action === "confirm" ? {body: JSON.stringify({confirm: true})} : {})}, userId); await refresh(); }
    catch (e) { setError((e as Error).message); await refresh().catch(() => {}); }
    finally { setBusy(false); }
  }

  return {docs, error, busy, uploading, uploadNotice, upload, download, extract};
}

export function CaseDocumentUpload() {
  const {busy, uploading, upload} = useDocuments();
  return <FileDrop label="Add files" accept={ACCEPT} disabled={busy} busy={uploading} onFiles={files => void upload(files)}/>;
}

export function CaseDocumentFeedback() {
  const {error, uploading, uploadNotice} = useDocuments();
  return <>{(uploading || uploadNotice) && <p className="case-chat-feedback" role="status">{uploading ?? uploadNotice}</p>}{error && <p className="case-chat-feedback" role="alert">{error}</p>}</>;
}

/** The case document library. `bare` renders just the list (for the case-page panel) without its disclosure. */
export function Documents({bare = false}: {bare?: boolean}) {
  const {docs, busy, download, extract} = useDocuments();
  const body = <section id={bare ? "section-documents" : undefined} className={bare ? "documents chat-panel-documents" : "disclosure-body"} aria-label="Documents">
    {docs.length === 0 && <p className="quiet-line">No documents yet. Use Add files in the conversation for PDFs or images, up to 5 MB each.</p>}
    <ul className="doc-list"><AnimatePresence initial={false}>{docs.map(doc => {
      const result = doc.extraction_result;
      const canRead = doc.state === "ready" && (!doc.extraction_state || ["source_ready", "direct_failed"].includes(doc.extraction_state));
      return <motion.li layout key={doc.id} id={`document-${doc.id}`} className="doc-row" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}}>
        <div className="doc-head">
          <FileIcon size={16} aria-hidden="true"/>
          <strong>{doc.filename}</strong>
          <span className="doc-reading" data-state={doc.confirmed_at ? "confirmed" : doc.extraction_state ?? "none"}>{readingLabel(doc)}</span>
          {canRead && <button className="text-button" disabled={busy} onClick={() => void extract(doc.id, "start")}>{doc.extraction_error ? "Try again" : "Read it"}</button>}
          {READING.includes(doc.extraction_state ?? "") && <button className="text-button" disabled={busy} onClick={() => void extract(doc.id, "refresh")}>Refresh</button>}
          {doc.state === "ready" && <button className="text-button" onClick={() => void download(doc)} aria-label={`Download ${doc.filename}`}>Download</button>}
        </div>
        {result && <details><summary>What we read</summary>
          <p className="message-body">{result.visible_text}</p>
          <dl>{(["insurer_name", "member_name", "member_id", "group_number", "claim_number"] as const).map(key => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{result[key] ?? "Not found"}</dd></div>)}</dl>
          {result.uncertainties.length > 0 && <ul>{result.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>}
          {!doc.confirmed_at && <button className="secondary" disabled={busy} onClick={() => void extract(doc.id, "confirm")}>This matches my document</button>}
        </details>}
      </motion.li>;
    })}</AnimatePresence></ul>
    </section>;
  if (bare) return body;
  return <details id="section-documents" className="case-disclosure documents">
    <summary><span className="disclosure-icon"><FileIcon size={17} aria-hidden="true"/></span><span>Case documents<small>Original files and what we read</small></span><span className="disclosure-count">{docs.length}</span></summary>
    {body}
  </details>;
}
