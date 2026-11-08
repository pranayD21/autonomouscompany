import {test} from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {ClaimComposer} from "../src/ui/ClaimComposer";

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
