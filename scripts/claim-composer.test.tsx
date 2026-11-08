import {test} from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {ClaimComposer} from "../src/ui/ClaimComposer";
import {FileDrop} from "../src/ui/FileDrop";

function render(value: string, busy = false, needsAnswer = false) {
  return renderToStaticMarkup(<ClaimComposer value={value} busy={busy} needsAnswer={needsAnswer} onChange={() => {}} onSubmit={() => {}}/>);
}

test("composer labels the real response action and document shortcut", () => {
  const html = render("An update");
  assert.match(html, /aria-label="Message Assurance"/);
  assert.match(html, /aria-label="Send response"/);
  assert.match(html, /title="Go to case documents"/);
  assert.match(html, /maxLength="4000"/);
  assert.doesNotMatch(html, /Voice message|Search the web|Think deeply/);
});

test("empty responses cannot be submitted", () => {
  for (const value of ["", "   "]) assert.match(render(value), /type="submit" disabled=""/);
  assert.doesNotMatch(render("Claim update"), /type="submit" disabled=""/);
});

test("saving locks the composer and exposes its busy state", () => {
  const html = render("Claim update", true);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<textarea[^>]+disabled=""/);
  assert.match(html, /aria-label="Saving response"/);
  assert.match(html, /type="submit" disabled=""/);
});

test("answer mode and user content are rendered safely", () => {
  const html = render("<script>private update</script>", false, true);
  assert.match(html, /Share your answer with Assurance/);
  assert.match(html, /&lt;script&gt;private update&lt;\/script&gt;/);
  assert.match(html, /Shift \+ Enter for a new line/);
});

test("persistent conversation preserves retry and read-only controls", () => {
  const html = renderToStaticMarkup(<ClaimComposer value="Pending message" busy={false} needsAnswer={false} readOnly sendLabel="Retry message" onChange={() => {}} onSubmit={() => {}}/>);
  assert.match(html, /readOnly=""/);
  assert.match(html, /aria-label="Retry message"/);
  assert.doesNotMatch(html, /type="submit" disabled=""/);
  const disabled = renderToStaticMarkup(<ClaimComposer value="Update" busy={false} needsAnswer={false} disabled onChange={() => {}} onSubmit={() => {}}/>);
  assert.match(disabled, /type="submit" disabled=""/);
});

test("animated uploader mounts inside the composer without a duplicate document shortcut", () => {
  const html = renderToStaticMarkup(<ClaimComposer value="" busy={false} needsAnswer={false} onChange={() => {}} onSubmit={() => {}} attachment={<FileDrop label="Add files" accept="application/pdf,image/png" onFiles={() => {}}/>}/>);
  assert.match(html, /Add files/);
  assert.match(html, /type="file" multiple="" accept="application\/pdf,image\/png"/);
  assert.match(html, /aria-label="Document file"/);
  assert.doesNotMatch(html, /Go to case documents/);
  assert.equal((html.match(/type="file"/g) ?? []).length, 1);
  assert.equal((html.match(/<form/g) ?? []).length, 1);
});

test("upload progress disables file selection and remains truthful", () => {
  const html = renderToStaticMarkup(<FileDrop label="Add files" accept="application/pdf" busy="Uploading claim.pdf" onFiles={() => {}}/>);
  assert.match(html, /Uploading claim.pdf/);
  assert.match(html, /data-disabled="true"/);
  assert.match(html, /<input[^>]*disabled=""[^>]*aria-label="Document file"/);
  assert.doesNotMatch(html, /Read and confirmed/);
});

test("character count appears only near the message limit", () => {
  const short = renderToStaticMarkup(<ClaimComposer value="A short update" onChange={() => {}} onSubmit={() => {}} busy={false} needsAnswer={false}/>);
  const long = renderToStaticMarkup(<ClaimComposer value={"Claim update ".repeat(300)} onChange={() => {}} onSubmit={() => {}} busy={false} needsAnswer={false}/>);
  assert.doesNotMatch(short, /claim-composer-count/);
  assert.match(long, /claim-composer-count/);
});
