import test from "node:test";
import assert from "node:assert/strict";
import { createPrintLayout, printNote } from "../src/pdf.js";

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

test("print content remains available after the print request for asynchronous iPad preview", () => {
  const documentRef = fakeDocument();
  let printRequests = 0;
  printNote({ title: "Test", document: { version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Visible in preview", bold: false }] },
  ] } }, documentRef, () => { printRequests += 1; });

  assert.equal(printRequests, 1);
  assert.equal(documentRef.querySelector(".print-note").childNodes[1].childNodes[0].textContent, "Visible in preview");
});

function fakeDocument() {
  const body = fakeElement("body");
  return {
    body,
    createElement: (tag) => fakeElement(tag),
    createTextNode: (text) => ({ textContent: text }),
    querySelector(selector) {
      return selector === ".print-note" ? body.childNodes.find((node) => node.className === "print-note") ?? null : null;
    },
  };
}

function fakeElement(tag) {
  return {
    tag, className: "", childNodes: [], attributes: {}, textContent: "",
    append(...nodes) { this.childNodes.push(...nodes); for (const node of nodes) node.parent = this; },
    setAttribute(name, value) { this.attributes[name] = value; },
    remove() {
      if (!this.parent) return;
      this.parent.childNodes = this.parent.childNodes.filter((node) => node !== this);
    },
  };
}
