import test from "node:test";
import assert from "node:assert/strict";
import { createBackup, parseBackup, serializeBackup } from "../src/backup.js";

function note(id = "note-1") {
  return {
    id,
    title: "Test",
    document: { version: 1, blocks: [{ type: "paragraph", spans: [{ text: "Body", bold: false }] }] },
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:05:00.000Z",
  };
}

test("a complete backup round-trips active and deleted notes", () => {
  const deleted = { ...note("note-2"), deletedAt: "2026-09-17T10:10:00.000Z" };
  const backup = createBackup([note(), deleted], new Date("2026-09-17T11:00:00.000Z"));
  const parsed = parseBackup(serializeBackup(backup));
  assert.equal(parsed.formatVersion, 1);
  assert.deepEqual(parsed.notebook.notes, [note(), deleted]);
});

test("backups preserve bullet blocks", () => {
  const listed = note();
  listed.document.blocks.push({ type: "bullet", spans: [{ text: "A bullet", bold: true }] });
  const parsed = parseBackup(serializeBackup(createBackup([listed])));
  assert.deepEqual(parsed.notebook.notes[0].document.blocks[1], { type: "bullet", spans: [{ text: "A bullet", bold: true }] });
});

test("malformed JSON is rejected before restore", () => {
  assert.throws(() => parseBackup("{not-json"), /not valid JSON/);
});

test("unsupported backup versions are rejected", () => {
  const backup = createBackup([note()]);
  backup.formatVersion = 99;
  assert.throws(() => parseBackup(JSON.stringify(backup)), /not supported/);
});

test("invalid notes and duplicate identifiers are rejected", () => {
  const invalid = createBackup([note()]);
  invalid.notebook.notes[0].document.blocks[0].spans[0].bold = "yes";
  assert.throws(() => parseBackup(JSON.stringify(invalid)), /notes.*invalid/);

  const duplicate = createBackup([note("same"), note("other")]);
  duplicate.notebook.notes[1].id = "same";
  assert.throws(() => parseBackup(JSON.stringify(duplicate)), /duplicate/);
});
