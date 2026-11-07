import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";
import { createHash } from "node:crypto";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const documentFiles = () => new Files({ adapter: neon({ bucket: "case-documents" }) });
export function validateDocument(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Use a nonempty file smaller than 5 MB.");
  const b = Buffer.from(bytes);
  const valid = mime === "image/png" ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === "image/jpeg" ? b[0]===255 && b[1]===216 && b[2]===255
    : mime === "image/webp" ? b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP"
    : mime === "application/pdf" ? b.toString("ascii",0,5)==="%PDF-" : false;
  if (!valid) throw new Error("Upload a PNG, JPEG, WebP, or PDF matching its file type.");
  return createHash("sha256").update(bytes).digest("hex");
}
