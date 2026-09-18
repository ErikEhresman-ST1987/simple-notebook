import test from "node:test";
import assert from "node:assert/strict";
import { searchNotes } from "../src/search.js";

const notes = [
  note("1", "Meeting Notes", [
    { type: "paragraph", spans: [{ text: "Discuss the quarterly report", bold: false }] },
  ]),
  note("2", "Shopping", [
    { type: "bullet", spans: [{ text: "Almond milk", bold: true }] },
    { type: "bullet", spans: [{ text: "Bananas", bold: false }] },
  ]),
];

test("search matches titles with case-insensitive partial text", () => {
  assert.deepEqual(searchNotes(notes, "MEET").map((note) => note.id), ["1"]);
});

test("search matches complete structured note text including bullets and bold spans", () => {
  assert.deepEqual(searchNotes(notes, "mond mi").map((note) => note.id), ["2"]);
  assert.deepEqual(searchNotes(notes, "quarterly").map((note) => note.id), ["1"]);
});

test("blank search preserves the existing note order", () => {
  assert.strictEqual(searchNotes(notes, "   "), notes);
});

test("search returns an empty list when there is no match", () => {
  assert.deepEqual(searchNotes(notes, "unavailable"), []);
});

function note(id, title, blocks) {
  return { id, title, document: { version: 1, blocks } };
}
