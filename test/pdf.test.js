import test from "node:test";
import assert from "node:assert/strict";
import { createPrintLayout } from "../src/pdf.js";

test("print layout preserves paragraphs, bold spans, and grouped bullets", () => {
  const layout = createPrintLayout({ title: "  Meeting  ", document: { version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Opening", bold: false }] },
    { type: "bullet", spans: [{ text: "First", bold: true }] },
    { type: "bullet", spans: [{ text: "Second", bold: false }] },
    { type: "paragraph", spans: [{ text: "Closing", bold: true }] },
  ] } });

  assert.deepEqual(layout, {
    title: "Meeting",
    content: [
      { type: "paragraph", spans: [{ text: "Opening", bold: false }] },
      { type: "bullets", items: [
        [{ text: "First", bold: true }],
        [{ text: "Second", bold: false }],
      ] },
      { type: "paragraph", spans: [{ text: "Closing", bold: true }] },
    ],
  });
});

test("untitled print layout does not duplicate the first line as a heading", () => {
  const layout = createPrintLayout({ title: "", document: { version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "First line", bold: false }] },
  ] } });
  assert.equal(layout.title, "");
  assert.equal(layout.content[0].spans[0].text, "First line");
});
