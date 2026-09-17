import { isValidStoredNote } from "./note-model.js";

export const BACKUP_FORMAT = "simple-notebook-backup";
export const BACKUP_VERSION = 1;

export function createBackup(notes, now = new Date()) {
  if (!Array.isArray(notes) || !notes.every(isValidStoredNote)) throw new TypeError("Cannot back up invalid notebook data.");
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    createdAt: now.toISOString(),
    notebook: { notes: structuredClone(notes) },
  };
}

export function serializeBackup(backup) {
  validateBackup(backup);
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseBackup(text) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error("This file is not valid JSON."); }
  validateBackup(value);
  return structuredClone(value);
}

export function validateBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT) throw new Error("This is not a Simple Notebook backup.");
  if (value.formatVersion !== BACKUP_VERSION) throw new Error("This backup version is not supported by this version of Simple Notebook.");
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) throw new Error("The backup creation date is invalid.");
  const notes = value.notebook?.notes;
  if (!Array.isArray(notes)) throw new Error("The backup does not contain a valid notebook.");
  if (!notes.every(isValidStoredNote)) throw new Error("One or more notes in the backup are invalid.");
  if (new Set(notes.map((note) => note.id)).size !== notes.length) throw new Error("The backup contains duplicate note identifiers.");
  return true;
}

export function backupFilename(createdAt = new Date()) {
  const stamp = createdAt.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return `Simple-Notebook-Backup-${stamp}.json`;
}
