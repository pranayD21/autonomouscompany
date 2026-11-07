import {test} from "node:test";
import assert from "node:assert/strict";
import {validateDocument,MAX_DOCUMENT_BYTES} from "../backend/document-storage";
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
test("document validation rejects executable/mismatched and oversized uploads",()=>{
 assert.throws(()=>validateDocument(Buffer.from("<svg/>"),"image/svg+xml"));
 assert.throws(()=>validateDocument(Buffer.from("<html/>"),"image/png"));
 assert.throws(()=>validateDocument(Buffer.alloc(MAX_DOCUMENT_BYTES+1),"application/pdf"));
 assert.throws(()=>validateDocument(Buffer.alloc(0),"image/png"));
 assert.equal(validateDocument(png,"image/png").length,64);
 assert.notEqual(validateDocument(png,"image/png"),validateDocument(Buffer.concat([png,Buffer.from([1])]),"image/png"));
});
