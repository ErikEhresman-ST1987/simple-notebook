import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle, documentText, emptyDocument, normalizeDocument, previewText } from "../src/note-model.js";

test("normalization permits only paragraphs and explicit bold spans", () => {
  const normalized = normalizeDocument({ version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Hello ", bold: false }, { text: "world", bold: true }] },
    { type: "heading", spans: [{ text: "Excluded", bold: false }] },
  ] });
  assert.deepEqual(normalized, { version: 1, blocks: [{ type: "paragraph", spans: [{ text: "Hello ", bold: false }, { text: "world", bold: true }] }] });
});

test("invalid documents become a usable empty document", () => { assert.deepEqual(normalizeDocument({ version: 99, blocks: [] }), emptyDocument()); });

test("plain text preserves paragraph boundaries", () => {
  assert.equal(documentText({ version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "First", bold: false }] },
    { type: "paragraph", spans: [{ text: "Second", bold: true }] },
  ] }), "First\nSecond");
});

test("display title prefers explicit title and otherwise uses first line", () => {
  const note = { title: "", document: { version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Fallback", bold: false }] },
    { type: "paragraph", spans: [{ text: "Preview", bold: false }] },
  ] } };
  assert.equal(displayTitle(note), "Fallback");
  assert.equal(previewText(note), "Preview");
  note.title = "  Meeting notes  ";
  assert.equal(displayTitle(note), "Meeting notes");
  assert.equal(previewText(note), "Fallback Preview");
});
