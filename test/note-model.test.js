import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle, documentText, emptyDocument, normalizeDocument, previewText } from "../src/note-model.js";

test("normalization permits paragraphs, bullets, and explicit bold spans", () => {
  const normalized = normalizeDocument({ version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Hello ", bold: false }, { text: "world", bold: true }] },
    { type: "bullet", spans: [{ text: "List item", bold: false }] },
    { type: "heading", spans: [{ text: "Excluded", bold: false }] },
  ] });
  assert.deepEqual(normalized, { version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "Hello ", bold: false }, { text: "world", bold: true }] },
    { type: "bullet", spans: [{ text: "List item", bold: false }] },
  ] });
});

test("invalid documents become a usable empty document", () => { assert.deepEqual(normalizeDocument({ version: 99, blocks: [] }), emptyDocument()); });

test("plain text preserves paragraph boundaries", () => {
  assert.equal(documentText({ version: 1, blocks: [
    { type: "paragraph", spans: [{ text: "First", bold: false }] },
    { type: "bullet", spans: [{ text: "Listed", bold: false }] },
    { type: "paragraph", spans: [{ text: "Second", bold: true }] },
  ] }), "First\nListed\nSecond");
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
